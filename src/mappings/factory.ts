import { Address, BigInt, BigDecimal } from '@graphprotocol/graph-ts'
import { log } from '@graphprotocol/graph-ts/'
import {
  ZERO_BD,
  isCrp,
  getCrpController,
  getCrpSymbol,
  getCrpName,
  getCrpRights,
  getCrpCap,
} from './helpers'
import { SwaapProtocol, Pool } from '../../generated/schema'
import { LOG_NEW_POOL } from '../../generated/Factory/Factory'
import { ConfigurableRightsPool } from '../../generated/Factory/ConfigurableRightsPool'
import { CrpControllerContract, PoolContract } from '../types/templates'
import { INITIAL_SWAP_FEES } from './constants'
import {initSwaps} from "./swaps";


export function handleNewPool(event: LOG_NEW_POOL): void {

  let factory = SwaapProtocol.load('1')

  // if no factory yet, set up blank initial
  if (factory == null) {
    log.warning('FACTORY: No factory saved yet... ', [])

    factory = new SwaapProtocol('1')
    factory.poolCount = 0
    factory.finalizedPoolCount = 0
    factory.crpCount = 0
    factory.txCount = BigInt.fromI32(0)
    factory.totalLiquidity = ZERO_BD
    factory.totalSwapVolume = ZERO_BD
    factory.totalSwapFee = ZERO_BD
  }

  let pool = new Pool(event.params.pool.toHexString())
  pool.crp = isCrp(event.params.caller)
  pool.rights = []
  if (pool.crp) {
    factory.crpCount += 1
    let crp = ConfigurableRightsPool.bind(event.params.caller)
    pool.symbol = getCrpSymbol(crp)
    pool.name = getCrpName(crp)
    pool.crpController = Address.fromString(getCrpController(crp)!)
    pool.rights = getCrpRights(crp)
    pool.cap = getCrpCap(crp)

    // Listen for any future crpController changes.
    CrpControllerContract._create(event.params.caller)
  }
  pool.controller = event.params.caller
  pool.publicSwap = false
  pool.finalized = false
  pool.active = true
  pool.swapFee = BigDecimal.fromString(INITIAL_SWAP_FEES)
  pool.totalWeight = ZERO_BD
  pool.totalShares = ZERO_BD
  pool.totalSwapVolume = ZERO_BD
  pool.totalSwapFee = ZERO_BD
  pool.liquidity = ZERO_BD
  pool.createTime = event.block.timestamp.toI32()
  pool.tokensCount = BigInt.fromI32(0)
  pool.holdersCount = BigInt.fromI32(0)
  pool.joinsCount = BigInt.fromI32(0)
  pool.exitsCount = BigInt.fromI32(0)
  pool.swapsCount = BigInt.fromI32(0)
  pool.factoryID = event.address.toHexString()
  pool.tokensList = []
  pool.tx = event.transaction.hash
  pool.save()
  log.info('FACTORY: new pool saved', [])

  // Link to roundFees
  initSwaps(pool, event)

  factory.poolCount = factory.poolCount + 1
  factory.save()

  // TODO NZ: Understand what is the need
  PoolContract._create(event.params.pool)
}
