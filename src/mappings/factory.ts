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
import {
  WHITELISTED_POOLS,
  INITIAL_SWAP_FEES,
  INITIAL_PRICE_STATISTICS_LOOKBACK_IN_ROUND,
  INITIAL_PRICE_STATISTICS_LOOKBACK_STEP_IN_ROUND,
  INITIAL_DYNAMIC_COVERAGE_FEES_Z,
  INITIAL_DYNAMIC_COVERAGE_FEES_HORIZON,
  INITIAL_PRICE_STATISTICS_LOOKBACK_IN_SEC,
  INITIAL_MAX_PRICE_UNPEG_RATIO,
} from './constants'
import {initSwaps} from "./swaps";


export function handleNewPool(event: LOG_NEW_POOL): void {

  const factoryAddress = event.address.toHexString()
  let factory = SwaapProtocol.load(factoryAddress)

  // if no factory yet, set up blank initial
  if (factory == null) {
    log.warning('FACTORY: No factory saved yet... ', [])

    factory = new SwaapProtocol(factoryAddress)
    factory.poolCount = 0
    factory.finalizedPoolCount = 0
    factory.crpCount = 0
    factory.txCount = BigInt.fromI32(0)
    factory.totalLiquidity = ZERO_BD
    factory.totalSwapVolume = ZERO_BD
    factory.totalSwapFee = ZERO_BD
  }

  const poolAddress = event.params.pool.toHexString()

  if (!WHITELISTED_POOLS.includes(poolAddress)) {
    log.warning('FACTORY: Un-whitelisted pool: skipped {}', [poolAddress])
  }
  else {
	let pool = new Pool(poolAddress)
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
	pool.priceStatisticsLookbackInRound = INITIAL_PRICE_STATISTICS_LOOKBACK_IN_ROUND
	pool.priceStatisticsLookbackStepInRound = INITIAL_PRICE_STATISTICS_LOOKBACK_STEP_IN_ROUND
	pool.dynamicCoverageFeesZ = INITIAL_DYNAMIC_COVERAGE_FEES_Z
	pool.dynamicCoverageFeesHorizon = INITIAL_DYNAMIC_COVERAGE_FEES_HORIZON
	pool.priceStatisticsLookbackInSec = INITIAL_PRICE_STATISTICS_LOOKBACK_IN_SEC
	pool.maxPriceUnpegRatio = INITIAL_MAX_PRICE_UNPEG_RATIO
	pool.factoryID = factoryAddress
	pool.tokensList = []
	pool.tx = event.transaction.hash

	pool.save()
	log.info('FACTORY: new pool saved', [])

	// Link to dailyActivity
	initSwaps(pool, event)

	factory.poolCount = factory.poolCount + 1
	factory.save()

	PoolContract._create(event.params.pool)
  }
}
