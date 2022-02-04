import { ethereum, log, BigDecimal } from '@graphprotocol/graph-ts'
import { DAY, generateId, getNow, MINUTE } from './constants'
import { Pool, RoundFees, Swap } from '../../generated/schema'
import { Timestamp } from '../types/business'
import { LOG_SWAP } from '../../generated/templates/Pool/Pool'

//log.warning('NIK SWAP starting', [])

// Add pool.roundFees

export function initSwaps(pool: Pool, event: ethereum.Event): void {
  const cache: i32 = 2 * MINUTE
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
    log.error('NIK SWAP : No association of roundfees for pool {}', [pool.id])
    log.critical('No roundfees association', [])
  }
  const roundFees = RoundFees.load(pool.roundFees!)!
  if (roundFees === null) {
    log.error('NIK SWAP : unable to load roundfees {}', [pool.roundFees!])
    log.critical('No roundfees saved with id {}', [pool.roundFees!])
  }
  add(swap, roundFees, limit)
  const calculus = calculate(roundFees, limit)
  roundFees.dailyVolume = calculus[0]
  roundFees.dailyFees = calculus[1]
  roundFees.save()
}

function add(swap: Swap, roundFees: RoundFees, limit: Timestamp): void {
  let today = roundFees.today
  let yesterday = roundFees.yesterday
  if (today.length > 0) {
    const firstId = today[0]
    const first = Swap.load(firstId)!
    if (first.timestamp < limit) {
      yesterday = today
      today = []
      roundFees.dailyVolume = BigDecimal.zero() // will be updated
      roundFees.dailyFees = BigDecimal.zero() // will be updated
      log.warning('NIK SWAP : new day : first ({}) -> now ({})', [
        first.timestamp.toString(),
        swap.timestamp.toString(),
      ])
    }
  } else {
    log.warning('NIK BUG No data for today', [])
  }

  log.warning('NIK BUG pushing', [])

  today.push(swap.id)
  log.warning('NIK BUG pushed with length {}', [today.length.toString()])
  log.warning('NIK BUG first item {}', [today[0]])
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
  log.warning('NIK BUG calculate with length {}', [
    roundFees.today.length.toString(),
  ])

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

  log.warning('NIK BUG calculated volume {} and fees {} for swaps count {}', [
    volume.toString(),
    fees.toString(),
    swapCount.toString(),
  ])

  return [volume, fees, BigDecimal.fromString(swapCount.toString())]
}
