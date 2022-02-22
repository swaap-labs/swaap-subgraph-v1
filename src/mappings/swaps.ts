import { ethereum, log, BigDecimal, BigInt } from '@graphprotocol/graph-ts'
import { DAY, generateId, getNow, MINUTE } from './constants'
import { Pool, RoundFees, Swap } from '../../generated/schema'
import { Timestamp } from '../types/business'
import { LOG_SWAP } from '../../generated/templates/Pool/Pool'

//log.warning('NIK SWAP starting', [])

// Add pool.roundFees
const cache: i32 = 240 * MINUTE

export function initSwaps(pool: Pool, event: ethereum.Event): void {
  const now = getNow(event)

  const roundFees = new RoundFees(generateId(event))
  roundFees.poolAddress = pool.id
  roundFees.dailyFees = BigDecimal.zero()
  roundFees.dailyVolume = BigDecimal.zero()
  roundFees.yesterday = []
  roundFees.today = []
  roundFees.last = now - cache
  roundFees.save()
  pool.roundFees = roundFees.id
  pool.save()
}

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

    roundFees.save()
  }
}

function add(swap: Swap, roundFees: RoundFees, limit: Timestamp): void {
  let today = roundFees.today
  let yesterday = roundFees.yesterday
  if (today.length > 0) {
    const firstId = today[0]

    const first = Swap.load(firstId)!
    if (first.timestamp < limit) {
      const t: i64 = BigInt.fromString(
        (swap.timestamp * 1000).toString()
      ).toI64()
      const day = new Date(t).toISOString()
      log.info('SWAP switching day {}', [day])

      yesterday = today
      today = []
      roundFees.dailyVolume = BigDecimal.zero() // will be updated
      roundFees.dailyFees = BigDecimal.zero() // will be updated
    }
  }
  today.push(swap.id)

  roundFees.today = today
  roundFees.yesterday = yesterday

  roundFees.save()
}

function calculate(roundFees: RoundFees, limit: Timestamp): BigDecimal[] {
  let sumFeesYesterday = BigDecimal.zero()
  let sumVolumeYesterday = BigDecimal.zero()
  let sumFeesToday = BigDecimal.zero()
  let sumVolumeToday = BigDecimal.zero()
  let swapCount = 0

  // Swaps from yesterday not older than 24h
  for (let i = 0; i < roundFees.yesterday.length; i++) {
    const currentId = roundFees.yesterday[i]

    const current = Swap.load(currentId)!

    if (current.timestamp > limit) {
      sumFeesYesterday = sumFeesYesterday.plus(current.feeValue)
      sumVolumeYesterday = sumVolumeYesterday.plus(current.value)
      swapCount++
    }
  }

  // Swaps from today

  for (let i = 0; i < roundFees.today.length; i++) {
    const currentId = roundFees.today[i]
    const current = Swap.load(currentId)!

    sumFeesToday = sumFeesToday.plus(current.feeValue)
    sumVolumeToday = sumVolumeToday.plus(current.value)
    swapCount++
  }

  const volume = sumVolumeToday.plus(sumVolumeYesterday)
  const fees = sumFeesToday.plus(sumFeesYesterday)
  log.warning('NIK SWAP Has calculated {} {} {}', [
    volume.toString(),
    fees.toString(),
    swapCount.toString(),
  ])

  return [volume, fees, BigDecimal.fromString(swapCount.toString())]
}
