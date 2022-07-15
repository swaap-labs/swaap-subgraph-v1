import { ethereum } from '@graphprotocol/graph-ts'
import { BigDecimal, BigInt } from '@graphprotocol/graph-ts'
import {Timestamp} from "../types/business";

export const INITIAL_SWAP_FEES = '0.000001'
export const INITIAL_PRICE_STATISTICS_LOOKBACK_IN_ROUND = 5
export const INITIAL_PRICE_STATISTICS_LOOKBACK_STEP_IN_ROUND = 4
export const INITIAL_DYNAMIC_COVERAGE_FEES_Z = BigDecimal.fromString("6")
export const INITIAL_DYNAMIC_COVERAGE_FEES_HORIZON = BigDecimal.fromString("5")
export const INITIAL_PRICE_STATISTICS_LOOKBACK_IN_SEC = BigInt.fromString("3600")
export const INITIAL_MAX_PRICE_UNPEG_RATIO = BigDecimal.fromString("1.025")

export const WHITELISTED_POOLS: string[] = [
  "0x7f5f7411c2c7ec60e2db946abbe7dc354254870b"
]

// TIME is in second, not millisecond
export const SECOND = 1
export const MINUTE = 60 * SECOND
export const HOUR = 60 * MINUTE
export const DAY = 24 * HOUR

export const EVENT_MSG_DATA_HEX_OFFSET = 10
export const EVENT_MSG_DATA_HEX_ARG_LENGTH = 64
export const EVENT_MSG_DATA_HEX_ADDRESS_OFFSET = 24

export function getYesterday(event: ethereum.Event):Timestamp {
  return event.block.timestamp.toI32() - DAY
}
export function getNow(event: ethereum.Event):Timestamp {
  return event.block.timestamp.toI32()
}

export function generateId(event: ethereum.Event): string {
  return event.transaction.hash.toHex() + '-' + event.logIndex.toString()
}
