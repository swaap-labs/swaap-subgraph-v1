import { ethereum } from '@graphprotocol/graph-ts'
import {Timestamp} from "../types/business";

export const INITIAL_SWAP_FEES = '0.000001'

// TIME is in second, not millisecond
export const SECOND = 1
export const MINUTE = 60 * SECOND
export const HOUR = 60 * MINUTE
export const DAY = 24 * HOUR

export function getYesterday(event: ethereum.Event):Timestamp {
  return event.block.timestamp.toI32() - DAY
}
export function getNow(event: ethereum.Event):Timestamp {
  return event.block.timestamp.toI32()
}

export function generateId(event: ethereum.Event): string {
  return event.transaction.hash.toHex() + '-' + event.logIndex.toString()
}
