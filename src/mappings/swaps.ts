import { ethereum, log, BigDecimal, BigInt } from '@graphprotocol/graph-ts'
import { DAY, generateId, getNow, MINUTE } from './constants'
import { Pool, RoundFees, Swap } from '../../generated/schema'
import { Timestamp } from '../types/business'
import { LOG_SWAP } from '../../generated/templates/Pool/Pool'


// Daily activity will be recalculated once every cache minute
const cache: i32 = 10 * MINUTE

/* Called at the creation of a new pool, starting with empty arrays */
export function initSwaps(pool: Pool, event: ethereum.Event): void {
  const now = getNow(event)

  const roundFees = new RoundFees(generateId(event))
  roundFees.poolAddress = pool.id
  roundFees.dailyFees = BigDecimal.zero()
  roundFees.dailyVolume = BigDecimal.zero()

  /**
   * We are creating an array of {timestamp, fee, volume} representing each swap
   * But for reason of entity process, it is split into separated arrays
   * for RoundFees entity, we can't easily store related entity to the entity: we would
   * need to load an entity for each swap, instead of loading a full array
   */
  roundFees.yesterdayTimestamps = []
  roundFees.yesterdayFees = []
  roundFees.yesterdayVolumes = []
  roundFees.todayTimestamps = []
  roundFees.todayFees = []
  roundFees.todayVolumes = []
  roundFees.last = now - cache
  roundFees.save()
  pool.roundFees = roundFees.id
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
  if (!pool.roundFees) {
    log.error('ADD SWAP : No association of roundfees for pool {}', [pool.id])
    log.critical('ADD SWAP No roundfees association', [])
  }
  const roundFees = RoundFees.load(pool.roundFees!)!
  if (roundFees === null) {
    log.error('ADD SWAP : unable to load roundfees {}', [pool.roundFees!])
    log.critical('ADD SWAP : No roundfees saved with id {}', [pool.roundFees!])
  }

  add(swap, roundFees, limit)

  if (now > roundFees.last + cache) {
    const calculus = calculate(roundFees, limit)

    roundFees.dailyVolume = calculus[0]
    roundFees.dailyFees = calculus[1]
    roundFees.last = now
    roundFees.swapCount = BigInt.fromString(calculus[2].toString()).toI32()

    roundFees.save()
  }
}

function add(swap: Swap, roundFees: RoundFees, limit: Timestamp): void {
  let yesterdayTimestamps = roundFees.yesterdayTimestamps
  let yesterdayFees = roundFees.yesterdayFees
  let yesterdayVolumes = roundFees.yesterdayVolumes
  let todayTimestamps = roundFees.todayTimestamps
  let todayFees = roundFees.todayFees
  let todayVolumes = roundFees.todayVolumes

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

  roundFees.yesterdayTimestamps = yesterdayTimestamps
  roundFees.yesterdayVolumes = yesterdayVolumes
  roundFees.yesterdayFees = yesterdayFees
  roundFees.todayTimestamps = todayTimestamps
  roundFees.todayVolumes = todayVolumes
  roundFees.todayFees = todayFees
  roundFees.swapCount = roundFees.swapCount + 1

  roundFees.save()
}

// calculate apr, volume and count only once every cache time interval
function calculate(roundFees: RoundFees, limit: Timestamp): BigDecimal[] {
  let sumFeesYesterday = BigDecimal.zero()
  let sumVolumeYesterday = BigDecimal.zero()
  let sumFeesToday = BigDecimal.zero()
  let sumVolumeToday = BigDecimal.zero()
  let swapCount = 0

  // Swaps from yesterday not older than 24h
  for (let i = 0; i < roundFees.yesterdayTimestamps.length; i++) {
    const timestamp = roundFees.yesterdayTimestamps[i]
    const volume = roundFees.yesterdayVolumes[i]
    const fee = roundFees.yesterdayFees[i]

    if (timestamp > limit) {
      sumVolumeYesterday = sumVolumeYesterday.plus(volume)
      sumFeesYesterday = sumFeesYesterday.plus(fee)
      swapCount++
    }
  }

  // Swaps from today
  for (let i = 0; i < roundFees.todayTimestamps.length; i++) {
    const volume = roundFees.todayVolumes[i]
    const fee = roundFees.todayFees[i]

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
