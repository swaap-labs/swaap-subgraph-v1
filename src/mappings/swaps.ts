import { ethereum, log, BigDecimal, BigInt } from '@graphprotocol/graph-ts'
import { DAY, generateId, getNow, MINUTE } from './constants'
import { Pool, DailyActivity, Swap } from '../../generated/schema'
import { Timestamp } from '../types/business'
import { LOG_SWAP } from '../../generated/templates/Pool/Pool'


// Daily activity will be recalculated once every cache minute
const cache: i32 = 10 * MINUTE

/* Called at the creation of a new pool, starting with empty arrays */
export function initSwaps(pool: Pool, event: ethereum.Event): void {
  const now = getNow(event)

  const dailyActivity = new DailyActivity(generateId(event))
  dailyActivity.poolAddress = pool.id
  dailyActivity.dailyFees = BigDecimal.zero()
  dailyActivity.dailyVolume = BigDecimal.zero()

  /**
   * We are creating an array of {timestamp, fee, volume} representing each swap
   * But for reason of entity process, it is split into separated arrays
   * for DailyActivity entity, we can't easily store related entity to the entity: we would
   * need to load an entity for each swap, instead of loading a full array
   */
  dailyActivity.yesterdayTimestamps = []
  dailyActivity.yesterdayFees = []
  dailyActivity.yesterdayVolumes = []
  dailyActivity.todayTimestamps = []
  dailyActivity.todayFees = []
  dailyActivity.todayVolumes = []
  dailyActivity.last = now - cache
  dailyActivity.save()
  pool.dailyActivity = dailyActivity.id
  pool.save()
}

/**
 * Called after each swap, at the end of handleSwap function.
 * The goal is to aggregate pool daily fees with the right prices
 * @param pool
 * @param swap
 * @param event
 */
export function addSwap(pool: Pool, swap: Swap, event: LOG_SWAP): void {
  const now = swap.timestamp
  const limit = now - DAY
  if (!pool.dailyActivity) {
    log.error('ADD SWAP : No association of dailyActivity for pool {}', [pool.id])
    log.critical('ADD SWAP No dailyActivity association', [])
  }
  const dailyActivity = DailyActivity.load(pool.dailyActivity!)!
  if (dailyActivity === null) {
    log.error('ADD SWAP : unable to load dailyActivity {}', [pool.dailyActivity!])
    log.critical('ADD SWAP : No dailyActivity saved with id {}', [pool.dailyActivity!])
  }

  add(swap, dailyActivity, limit)

  if (now > dailyActivity.last + cache) {
    const calculus = calculate(dailyActivity, limit)

    dailyActivity.dailyVolume = calculus[0]
    dailyActivity.dailyFees = calculus[1]
    dailyActivity.last = now
    dailyActivity.swapCount = BigInt.fromString(calculus[2].toString()).toI32()

    dailyActivity.save()
  }
}

function add(swap: Swap, dailyActivity: DailyActivity, limit: Timestamp): void {
  let yesterdayTimestamps = dailyActivity.yesterdayTimestamps
  let yesterdayFees = dailyActivity.yesterdayFees
  let yesterdayVolumes = dailyActivity.yesterdayVolumes
  let todayTimestamps = dailyActivity.todayTimestamps
  let todayFees = dailyActivity.todayFees
  let todayVolumes = dailyActivity.todayVolumes

  if (todayTimestamps.length > 0) {
    const firstTimestamp = todayTimestamps[0]

    // first swap of the day, moving "todays" value as "yesterday", starting with a clean "today"
    // Next swaps will be compared to this new First swap
    if (firstTimestamp < limit) {
      const t: i64 = BigInt.fromString(
        (swap.timestamp * 1000).toString()
      ).toI64()
      const day = new Date(t).toISOString()
      log.info('SWAP switching day {}', [day])

      yesterdayTimestamps = todayTimestamps
      todayTimestamps = []
      yesterdayFees = todayFees
      todayFees = []
      yesterdayVolumes = todayVolumes
      todayVolumes = []
    }
  }
  // Always pushing the swap in Today arrays
  todayTimestamps.push(swap.timestamp)
  todayVolumes.push(swap.value)
  todayFees.push(swap.feeValue)

  dailyActivity.yesterdayTimestamps = yesterdayTimestamps
  dailyActivity.yesterdayVolumes = yesterdayVolumes
  dailyActivity.yesterdayFees = yesterdayFees
  dailyActivity.todayTimestamps = todayTimestamps
  dailyActivity.todayVolumes = todayVolumes
  dailyActivity.todayFees = todayFees
  dailyActivity.swapCount = dailyActivity.swapCount + 1

  dailyActivity.save()
}

// calculate apr, volume and count only once every cache time interval
function calculate(dailyActivity: DailyActivity, limit: Timestamp): BigDecimal[] {
  let sumFeesYesterday = BigDecimal.zero()
  let sumVolumeYesterday = BigDecimal.zero()
  let sumFeesToday = BigDecimal.zero()
  let sumVolumeToday = BigDecimal.zero()
  let swapCount = 0

  // Swaps from yesterday not older than 24h
  for (let i = 0; i < dailyActivity.yesterdayTimestamps.length; i++) {
    const timestamp = dailyActivity.yesterdayTimestamps[i]
    const volume = dailyActivity.yesterdayVolumes[i]
    const fee = dailyActivity.yesterdayFees[i]

    if (timestamp > limit) {
      sumVolumeYesterday = sumVolumeYesterday.plus(volume)
      sumFeesYesterday = sumFeesYesterday.plus(fee)
      swapCount++
    }
  }

  // Swaps from today
  for (let i = 0; i < dailyActivity.todayTimestamps.length; i++) {
    const volume = dailyActivity.todayVolumes[i]
    const fee = dailyActivity.todayFees[i]

    sumVolumeToday = sumVolumeToday.plus(volume)
    sumFeesToday = sumFeesToday.plus(fee)
    swapCount++
  }

  const volume = sumVolumeToday.plus(sumVolumeYesterday)
  const fees = sumFeesToday.plus(sumFeesYesterday)
  log.debug('SWAP Has calculated {} {} {}', [
    volume.toString(),
    fees.toString(),
    swapCount.toString(),
  ])

  return [volume, fees, BigDecimal.fromString(swapCount.toString())]
}
