import { Address, BigInt, BigDecimal } from '@graphprotocol/graph-ts'
import { LOG_NEW_POOL } from '../types/Factory/Factory'
import {Balancer, CounterLaab, Pool} from '../types/schema'
import { Pool as PoolContract, CrpController as CrpControllerContract } from '../types/templates'
import {log} from "@graphprotocol/graph-ts/"
import {
  ZERO_BD,
  isCrp,
  getCrpController,
  getCrpSymbol,
  getCrpName,
  getCrpRights,
  getCrpCap
} from './helpers'
import { ConfigurableRightsPool } from '../types/Factory/ConfigurableRightsPool';
import {ethereum} from "@graphprotocol/graph-ts/index";

export function handleBlock(event: ethereum.Event): void{
  let counter = CounterLaab.load('1')
  if (counter == null){
    counter = new CounterLaab('1')
    counter.save()
  }else{
    counter.count = counter.count.plus(BigInt.fromI32(1))
  }
  let block = event.block.number.mod(BigInt.fromI32(1000));
  let zero = BigInt.fromI32(0)

  if ( block.equals(zero)){
    log.debug("LAAB : block number {}", [counter.count.toString()])
  }
}

export function handleNewPool(event: LOG_NEW_POOL): void {
  let factory = Balancer.load('1')
  log.info("LAAB: new pool", []);

  // if no factory yet, set up blank initial
  if (factory == null) {
    factory = new Balancer('1')
    factory.color = 'Bronze'
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
  pool.swapFee = BigDecimal.fromString('0.000001')
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

  factory.poolCount = factory.poolCount + 1
  factory.save()

  PoolContract._create(event.params.pool)
}
