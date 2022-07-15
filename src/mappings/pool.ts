/// <reference path="../../node_modules/assemblyscript/index.d.ts" />
import {
  BigInt,
  Address,
  Bytes,
  store,
  BigDecimal,
} from '@graphprotocol/graph-ts'
import {
  GulpCall,
  LOG_CALL,
  LOG_EXIT,
  LOG_JOIN,
  LOG_SWAP,
  LOG_NEW_CONTROLLER,
  LOG_NEW_ORACLE_STATE,
  Pool as SPool,
  Transfer,
} from '../../generated/templates/Pool/Pool'
import { log } from '@graphprotocol/graph-ts/'

import {
  hexToInt,
  hexToDecimal,
  hexToBigInt,
  bigIntToDecimal,
  tokenToDecimal,
  createPoolShareEntity,
  createPoolTokenEntity,
  updatePoolLiquidity,
  createPoolOracleStateEntity,
  getCrpUnderlyingPool,
  saveTransaction,
  ZERO_BD,
  decrPoolCount,
  parseEvent256BitsSlot,
  parseEventAddressSlot
} from './helpers'
import {
  SwaapProtocol,
  Pool,
  PoolShare,
  PoolToken,
  Swap,
  TokenPrice,
  PoolOracleState
} from '../../generated/schema'
import {
  ConfigurableRightsPool,
  OwnershipTransferred,
} from '../../generated/Factory/ConfigurableRightsPool'
import { addSwap } from './swaps'


/************************************
 ********** Pool Controls ***********
 ************************************/

export function handleSetSwapFee(event: LOG_CALL): void {
  let poolId = event.address.toHex()
  let pool = Pool.load(poolId)
  if (pool == null) {
    log.error(
      'LOGIC handleSetSwapFee Saving fees to a null Pool {} - Returning too soon',
      [poolId]
    )
    log.critical(
      'LOGIC handleSetSwapFee Saving fees to a null Pool {} - Returning too soon',
      [poolId]
    )
    return
  }
  let swapFee = hexToDecimal(parseEvent256BitsSlot(event, 0), 18)
  pool.swapFee = swapFee
  pool.save()
  saveTransaction(event, 'setSwapFee')
}

export function handleSetPriceStatisticsLookbackInRound(event: LOG_CALL): void {
  let poolId = event.address.toHex()
  let pool = Pool.load(poolId)
  if (pool == null) {
    log.error(
      'LOGIC handleSetPriceStatisticsLookbackInRound Saving fees to a null Pool {} - Returning too soon',
      [poolId]
    )
    log.critical(
      'LOGIC handleSetPriceStatisticsLookbackInRound Saving fees to a null Pool {} - Returning too soon',
      [poolId]
    )
    return
  }
  let priceStatisticsLookbackInRound = hexToInt(parseEvent256BitsSlot(event, 0))
  pool.priceStatisticsLookbackInRound = priceStatisticsLookbackInRound
  pool.save()
  saveTransaction(event, 'setPriceStatisticsLookbackInRound')
}

export function handleSetPriceStatisticsLookbackStepInRound(event: LOG_CALL): void {
  let poolId = event.address.toHex()
  let pool = Pool.load(poolId)
  if (pool == null) {
    log.error(
      'LOGIC handleSetPriceStatisticsLookbackStepInRound Saving fees to a null Pool {} - Returning too soon',
      [poolId]
    )
    log.critical(
      'LOGIC handleSetPriceStatisticsLookbackStepInRound Saving fees to a null Pool {} - Returning too soon',
      [poolId]
    )
    return
  }
  let priceStatisticsLookbackStepInRound = hexToInt(parseEvent256BitsSlot(event, 0))
  pool.priceStatisticsLookbackStepInRound = priceStatisticsLookbackStepInRound
  pool.save()
  saveTransaction(event, 'setPriceStatisticsLookbackStepInRound')
}

export function handleSetDynamicCoverageFeesZ(event: LOG_CALL): void {
  let poolId = event.address.toHex()
  let pool = Pool.load(poolId)
  if (pool == null) {
    log.error(
      'LOGIC handleSetDynamicCoverageFeesZ Saving fees to a null Pool {} - Returning too soon',
      [poolId]
    )
    log.critical(
      'LOGIC handleSetDynamicCoverageFeesZ Saving fees to a null Pool {} - Returning too soon',
      [poolId]
    )
    return
  }
  let dynamicCoverageFeesZ = hexToDecimal(parseEvent256BitsSlot(event, 0), 18)
  pool.dynamicCoverageFeesZ = dynamicCoverageFeesZ
  pool.save()
  saveTransaction(event, 'setDynamicCoverageFeesZ')
}

export function handleSetDynamicCoverageFeesHorizon(event: LOG_CALL): void {
  let poolId = event.address.toHex()
  let pool = Pool.load(poolId)
  if (pool == null) {
    log.error(
      'LOGIC handleSetDynamicCoverageFeesHorizon Saving fees to a null Pool {} - Returning too soon',
      [poolId]
    )
    log.critical(
      'LOGIC handleSetDynamicCoverageFeesHorizon Saving fees to a null Pool {} - Returning too soon',
      [poolId]
    )
    return
  }
  let dynamicCoverageFeesHorizon = hexToDecimal(parseEvent256BitsSlot(event, 0), 18)
  pool.dynamicCoverageFeesHorizon = dynamicCoverageFeesHorizon
  pool.save()
  saveTransaction(event, 'setDynamicCoverageFeesHorizon')
}

export function handleSetPriceStatisticsLookbackInSec(event: LOG_CALL): void {
  let poolId = event.address.toHex()
  let pool = Pool.load(poolId)
  if (pool == null) {
    log.error(
      'LOGIC handleSetPriceStatisticsLookbackInSec Saving fees to a null Pool {} - Returning too soon',
      [poolId]
    )
    log.critical(
      'LOGIC handleSetPriceStatisticsLookbackInSec Saving fees to a null Pool {} - Returning too soon',
      [poolId]
    )
    return
  }
  let priceStatisticsLookbackInSec = hexToBigInt(parseEvent256BitsSlot(event, 0))
  pool.priceStatisticsLookbackInSec = priceStatisticsLookbackInSec
  pool.save()
  saveTransaction(event, 'setPriceStatisticsLookbackInSec')
}

export function handleSetMaxPriceUnpegRatio(event: LOG_CALL): void {
  let poolId = event.address.toHex()
  let pool = Pool.load(poolId)
  if (pool == null) {
    log.error(
      'LOGIC handleSetMaxPriceUnpegRatio Saving fees to a null Pool {} - Returning too soon',
      [poolId]
    )
    log.critical(
      'LOGIC handleSetMaxPriceUnpegRatio Saving fees to a null Pool {} - Returning too soon',
      [poolId]
    )
    return
  }
  let maxPriceUnpegRatio = hexToDecimal(parseEvent256BitsSlot(event, 0), 18)
  pool.maxPriceUnpegRatio = maxPriceUnpegRatio
  pool.save()
  saveTransaction(event, 'setMaxPriceUnpegRatio')
}

export function handleSetController(event: LOG_NEW_CONTROLLER): void {
  let poolId = event.address.toHex()
  let pool = Pool.load(poolId)!
  let controller = Address.fromString(
    event.params.to.toHexString()
  )
  pool.controller = controller
  pool.save()

  saveTransaction(event, 'setController')
}

export function handleSetCrpController(event: OwnershipTransferred): void {
  // This event occurs on the CRP contract rather than the underlying pool so we must perform a lookup.
  let crp = ConfigurableRightsPool.bind(event.address)
  let pool = Pool.load(getCrpUnderlyingPool(crp))!
  pool.crpController = event.params.newOwner
  pool.save()

  // We overwrite event address so that ownership transfers can be linked to Pool entities for above reason.
  event.address = Address.fromString(pool.id)
  saveTransaction(event, 'setCrpController')
}

export function handleSetPublicSwap(event: LOG_CALL): void {
  let poolId = event.address.toHex()
  let pool = Pool.load(poolId)!
  let publicSwap = event.params.data.toHexString().slice(-1) == '1'
  pool.publicSwap = publicSwap
  pool.save()

  saveTransaction(event, 'setPublicSwap')
}

export function handleFinalize(event: LOG_CALL): void {
  let poolId = event.address.toHex()
  let pool = Pool.load(poolId)!
  // let balance = BigDecimal.fromString('100')
  pool.finalized = true
  pool.symbol = 'SPT'
  pool.publicSwap = true
  // pool.totalShares = balance
  pool.save()
  log.info('Pool : Finalized the pool {}', [event.address.toHex()])

  /*
  let poolShareId = poolId.concat('-').concat(event.params.caller.toHex())
  let poolShare = PoolShare.load(poolShareId)
  if (poolShare == null) {
    createPoolShareEntity(poolShareId, poolId, event.params.caller.toHex())
    poolShare = PoolShare.load(poolShareId)!
  }
  poolShare.balance = balance
  poolShare.save()
  */

  let factory = SwaapProtocol.load('1')!
  factory.finalizedPoolCount = factory.finalizedPoolCount + 1
  factory.save()
  saveTransaction(event, 'finalize')
}

// LOG_NEW_ORACLE_STATE is fired by the bindMMM and rebindMMM functions
export function handleNewOracleState(event: LOG_NEW_ORACLE_STATE): void {
  let poolId = event.address.toHex()
  let pool = Pool.load(poolId)!
  let tokenAddress = event.params.token.toHexString()
  let oracleAddress = event.params.oracle.toHexString()
  let price = event.params.price
  let decimals = event.params.decimals
  let description = event.params.description.toString()

  let poolOracleStateId = poolId.concat('-').concat(tokenAddress)
  let poolOracleInitialState = PoolOracleState.load(poolOracleStateId)
  if (poolOracleInitialState == null) {
    log.info('PoolOracleInitialState is null, creating it {}', [poolOracleStateId])
    createPoolOracleStateEntity(poolOracleStateId, oracleAddress, description, price, decimals)
  } else {
  	poolOracleInitialState.proxy = oracleAddress // should be the same value
  	poolOracleInitialState.description = description
  	poolOracleInitialState.fixedPointPrice = price
  	poolOracleInitialState.decimals = decimals
  	poolOracleInitialState.save()
  }

  let priceBigInt = new BigDecimal(price);
  createTokenPrice(poolId, tokenAddress, priceBigInt)

  updatePoolLiquidity(poolId)
  saveTransaction(event, 'newOracleState')
}

export function handleRebind(event: LOG_CALL): void {
  let poolId = event.address.toHex()
  let pool = Pool.load(poolId)!
  let poolHexAddress = parseEventAddressSlot(event, 0)
  let tokenBytes = Bytes.fromHexString(
    poolHexAddress
  ) as Bytes
  let tokensList = pool.tokensList || []
  if (tokensList.indexOf(tokenBytes) == -1) {
    tokensList.push(tokenBytes)
  }
  pool.tokensList = tokensList
  pool.tokensCount = BigInt.fromI32(tokensList.length)

  let address = Address.fromString(
    poolHexAddress
  )
  let denormWeight = hexToDecimal(
    parseEvent256BitsSlot(event, 2),
    18
  )

  let poolTokenId = poolId.concat('-').concat(address.toHexString())

  let poolToken = PoolToken.load(poolTokenId)
  if (poolToken == null) {
    log.info('Pool token is null, creating it {}', [poolTokenId])

    createPoolTokenEntity(poolTokenId, poolId, address.toHexString())
    poolToken = PoolToken.load(poolTokenId)!
    pool.totalWeight = pool.totalWeight.plus(denormWeight)
  } else {
    let oldWeight = poolToken.denormWeight
    if (denormWeight > oldWeight) {
      pool.totalWeight = pool.totalWeight.plus(denormWeight.minus(oldWeight))
    } else {
      pool.totalWeight = pool.totalWeight.minus(oldWeight.minus(denormWeight))
    }
  }

  let balance = hexToDecimal(
    parseEvent256BitsSlot(event, 1),
    poolToken.decimals
  )

  poolToken.balance = balance
  poolToken.denormWeight = denormWeight

  poolToken.oracleInitialState = poolTokenId

  poolToken.save()

  if (balance.equals(ZERO_BD)) {
    decrPoolCount(pool.active, pool.finalized, pool.crp)
    pool.active = false
  }
  pool.save()

//   updatePoolLiquidity(poolId) --> triggered in handleNewOracleState
  saveTransaction(event, 'rebind')
}

export function handleUnbind(event: LOG_CALL): void {
  let poolId = event.address.toHex()
  let pool = Pool.load(poolId)!
  let poolHexAddress = parseEventAddressSlot(event, 0)
  let tokenBytes = Bytes.fromHexString(
    poolHexAddress
  ) as Bytes
  let tokensList = pool.tokensList || []
  let index = tokensList.indexOf(tokenBytes)
  tokensList.splice(index, 1)
  pool.tokensList = tokensList
  pool.tokensCount = BigInt.fromI32(tokensList.length)

  let address = Address.fromString(poolHexAddress)
  let poolTokenId = poolId.concat('-').concat(address.toHexString())
  let poolToken = PoolToken.load(poolTokenId)!
  pool.totalWeight = pool.totalWeight.minus(poolToken.denormWeight)
  pool.save()
  store.remove('PoolToken', poolTokenId)
  store.remove('PoolOracleState', poolTokenId)

  updatePoolLiquidity(poolId)
  saveTransaction(event, 'unbind')
}

export function handleGulp(call: GulpCall): void {
  let poolId = call.to.toHexString()
  let pool = Pool.load(poolId)!

  let address = call.inputs.token.toHexString()

  let spool = SPool.bind(Address.fromString(poolId))
  let balanceCall = spool.try_getBalance(Address.fromString(address))

  let poolTokenId = poolId.concat('-').concat(address)
  let poolToken = PoolToken.load(poolTokenId)!

  if (poolToken != null) {
    let balance = ZERO_BD
    if (!balanceCall.reverted) {
      balance = bigIntToDecimal(balanceCall.value, poolToken.decimals)
    }
    poolToken.balance = balance
    poolToken.save()
  }

  updatePoolLiquidity(poolId)
}

/************************************
 ********** JOINS & EXITS ***********
 ************************************/

export function handleJoinPool(event: LOG_JOIN): void {
  let poolId = event.address.toHex()
  let pool = Pool.load(poolId)!
  pool.joinsCount = pool.joinsCount.plus(BigInt.fromI32(1))
  pool.save()

  let address = event.params.tokenIn.toHex()
  let poolTokenId = poolId.concat('-').concat(address.toString())
  let poolToken = PoolToken.load(poolTokenId)
  if (poolToken == null) {
    log.error('LOGIC handleJoinPool: Illegal null poolToken with id {}', [
      poolTokenId,
    ])
    log.critical('LOGIC handleJoinPool: Illegal null poolToken with id {}', [
      poolTokenId,
    ])
    return
  }
  let tokenAmountIn = tokenToDecimal(
    event.params.tokenAmountIn.toBigDecimal(),
    poolToken.decimals
  )
  let newAmount = poolToken.balance.plus(tokenAmountIn)
  poolToken.balance = newAmount
  poolToken.save()

  updatePoolLiquidity(poolId)
  saveTransaction(event, 'join')
}

export function handleExitPool(event: LOG_EXIT): void {
  let poolId = event.address.toHex()

  let address = event.params.tokenOut.toHex()
  let poolTokenId = poolId.concat('-').concat(address.toString())
  let poolToken = PoolToken.load(poolTokenId)
  if (poolToken == null) {
    log.error('LOGIC handleExitPool exiting pool : no poolToken with id {}', [
      poolTokenId,
    ])
    log.critical(
      'LOGIC handleExitPool exiting pool : no poolToken with id {}',
      [poolTokenId]
    )
    return
  }

  let tokenAmountOut = tokenToDecimal(
    event.params.tokenAmountOut.toBigDecimal(),
    poolToken.decimals
  )
  let newAmount = poolToken.balance.minus(tokenAmountOut)
  poolToken.balance = newAmount
  poolToken.save()

  let pool = Pool.load(poolId)!
  pool.exitsCount = pool.exitsCount.plus(BigInt.fromI32(1))
  if (newAmount.equals(ZERO_BD)) {
    decrPoolCount(pool.active, pool.finalized, pool.crp)
    pool.active = false
  }
  pool.save()

  updatePoolLiquidity(poolId)
  saveTransaction(event, 'exit')
}

/************************************
 ************** SWAPS ***************
 ************************************/

export function handleSwap(event: LOG_SWAP): void {
  let poolId = event.address.toHex()

  let tokenIn = event.params.tokenIn.toHex()
  let poolTokenInId = poolId.concat('-').concat(tokenIn.toString())
  let poolTokenIn = PoolToken.load(poolTokenInId)
  if (poolTokenIn == null) {
    log.error('LOGIC handleSwap no poolToken for IN swap {}', [poolTokenInId])
    log.critical('LOGIC handleSwap no poolToken for IN swap {}', [
      poolTokenInId,
    ])
    return
  }

  let tokenAmountIn = tokenToDecimal(
    event.params.tokenAmountIn.toBigDecimal(),
    poolTokenIn.decimals
  )
  let newAmountIn = poolTokenIn.balance.plus(tokenAmountIn)
  poolTokenIn.balance = newAmountIn
  poolTokenIn.save()

  let tokenOut = event.params.tokenOut.toHex()
  let poolTokenOutId = poolId.concat('-').concat(tokenOut.toString())
  let poolTokenOut = PoolToken.load(poolTokenOutId)
  if (poolTokenOut == null) {
    log.error('LOGIC handleSwap no poolToken for OUT swap {}', [poolTokenOutId])
    log.critical('LOGIC handleSwap no poolToken for OUT swap {}', [
      poolTokenOutId,
    ])
    return
  }

  let tokenAmountOut = tokenToDecimal(
    event.params.tokenAmountOut.toBigDecimal(),
    poolTokenOut.decimals
  )
  let newAmountOut = poolTokenOut.balance.minus(tokenAmountOut)
  poolTokenOut.balance = newAmountOut
  poolTokenOut.save()

  // update tokenIn and tokenOut prices
  // TODO: only if whitelisted?
  let tokenInPriceValue = ZERO_BD
  if (true) {
	updateTokenPrice(poolId, tokenOut, event.params.priceOut.toBigDecimal())
	let tokenInPrice = updateTokenPrice(poolId, tokenIn, event.params.priceIn.toBigDecimal())
    if (tokenInPrice == null) {
      return
  	}
	tokenInPriceValue = tokenInPrice.price
  }

  updatePoolLiquidity(poolId)

  let swapId = event.transaction.hash
    .toHexString()
    .concat('-')
    .concat(event.logIndex.toString())
  let swap = Swap.load(swapId)
  if (swap == null) {
    swap = new Swap(swapId)
  }

  let pool = Pool.load(poolId)!

  const spread = tokenToDecimal(event.params.spread.toBigDecimal(), 18)
  const taxBaseIn = tokenToDecimal(
    event.params.taxBaseIn.toBigDecimal(),
    poolTokenIn.decimals
  )

  let factory = SwaapProtocol.load('1')!

  let swapValue = tokenInPriceValue.times(tokenAmountIn)
  let swapFeeValue = swapValue.times(pool.swapFee)
  	.plus(tokenInPriceValue.times(taxBaseIn).times(spread))
  let totalSwapVolume = pool.totalSwapVolume.plus(swapValue)
  let totalSwapFee = pool.totalSwapFee.plus(swapFeeValue)

  factory.totalSwapVolume = factory.totalSwapVolume.plus(swapValue)
  factory.totalSwapFee = factory.totalSwapFee.plus(swapFeeValue)

  pool.totalSwapVolume = totalSwapVolume
  pool.totalSwapFee = totalSwapFee

  pool.swapsCount = pool.swapsCount.plus(BigInt.fromI32(1))
  factory.txCount = factory.txCount.plus(BigInt.fromI32(1))
  factory.save()

  if (newAmountIn.equals(ZERO_BD) || newAmountOut.equals(ZERO_BD)) {
    decrPoolCount(pool.active, pool.finalized, pool.crp)
    pool.active = false
  }
  pool.save()

  swap.caller = event.params.caller
  swap.tokenIn = event.params.tokenIn
  swap.tokenInSym = poolTokenIn.symbol!
  swap.tokenOut = event.params.tokenOut
  swap.spread = spread
  swap.taxBaseIn = taxBaseIn
  swap.tokenOutSym = poolTokenOut.symbol!
  swap.tokenAmountIn = tokenAmountIn
  swap.tokenAmountOut = tokenAmountOut
  swap.poolAddress = event.address.toHex()
  swap.userAddress = event.transaction.from.toHex()
  swap.poolTotalSwapVolume = totalSwapVolume
  swap.poolTotalSwapFee = totalSwapFee
  swap.poolLiquidity = pool.liquidity
  swap.value = swapValue
  swap.feeValue = swapFeeValue
  swap.timestamp = event.block.timestamp.toI32()

  swap.save()
  addSwap(pool, swap, event)

  saveTransaction(event, 'swap')
}

function updateTokenPrice(poolId: string, token: string, unscaledPrice: BigDecimal): TokenPrice | null {
  let poolOracleStateId = poolId.concat('-').concat(token)
  let poolOracleInitialState = PoolOracleState.load(poolOracleStateId)
  if (poolOracleInitialState == null) {
    log.error('LOGIC updateTokenPrice no PoolOracleState for {}', [poolOracleStateId])
    log.critical('LOGIC updateTokenPrice no PoolOracleState for {}', [
      poolOracleStateId,
    ])
    return null
  }
  let tokenPriceId = token.concat('-').concat(poolOracleInitialState.proxy)
  let tokenPrice = TokenPrice.load(tokenPriceId)
  if (tokenPrice == null) {
    log.error('LOGIC updateTokenPrice no TokenPrice for {}', [tokenPriceId])
    log.critical('LOGIC updateTokenPrice no TokenPrice for {}', [
      tokenPriceId,
    ])
    return null
  }
  let newTokenInPriceValue = tokenToDecimal(
	unscaledPrice,
	poolOracleInitialState.decimals
  )
  tokenPrice.price = newTokenInPriceValue
  tokenPrice.save()
  return tokenPrice
}

function createTokenPrice(poolId: string, token: string, unscaledPrice: BigDecimal): void {
  let poolOracleStateId = poolId.concat('-').concat(token)
  let poolOracleInitialState = PoolOracleState.load(poolOracleStateId)!
  if (poolOracleInitialState == null) {
    log.error('LOGIC createTokenPrice no PoolOracleState for {}', [poolOracleStateId])
    log.critical('LOGIC createTokenPrice no PoolOracleState for {}', [
      poolOracleStateId,
    ])
  } else {
	let tokenPriceId = token.concat('-').concat(poolOracleInitialState.proxy)
	let tokenPrice = TokenPrice.load(tokenPriceId)
	if (tokenPrice == null) {
	  let poolTokenId = poolId.concat('-').concat(token)
	  let poolToken = PoolToken.load(poolTokenId)
	  if (poolToken == null) {
	  	log.error('LOGIC createTokenPrice no PoolToken for {}', [poolTokenId])
	  	log.critical('LOGIC createTokenPrice no PoolToken for {}', [
		  poolTokenId,
		])
	  } else {
	  let newTokenInPriceValue = tokenToDecimal(
	    unscaledPrice,
		poolOracleInitialState.decimals
	  )
	  tokenPrice = new TokenPrice(tokenPriceId)
	  tokenPrice.price = newTokenInPriceValue
	  tokenPrice.symbol = poolToken.symbol
	  tokenPrice.name = poolToken.name
	  tokenPrice.decimals = poolToken.decimals
	  tokenPrice.poolTokenId = poolTokenId
	  tokenPrice.save()
	}
	}
  }
}


/************************************
 *********** POOL SHARES ************
 ************************************/

export function handleTransfer(event: Transfer): void {
  let poolId = event.address.toHex()

  let ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'

  let isMint = event.params.from.toHex() == ZERO_ADDRESS
  let isBurn = event.params.to.toHex() == ZERO_ADDRESS

  let poolShareFromId = poolId.concat('-').concat(event.params.from.toHex())
  let poolShareFrom = PoolShare.load(poolShareFromId)
  let poolShareFromBalance =
    poolShareFrom == null ? ZERO_BD : poolShareFrom.balance

  let poolShareToId = poolId.concat('-').concat(event.params.to.toHex())
  let poolShareTo = PoolShare.load(poolShareToId)
  let poolShareToBalance = poolShareTo == null ? ZERO_BD : poolShareTo.balance

  let pool = Pool.load(poolId)!

  if (isMint) {
    if (poolShareTo == null) {
      createPoolShareEntity(poolShareToId, poolId, event.params.to.toHex())
      poolShareTo = PoolShare.load(poolShareToId)!
    }
    poolShareTo.balance = poolShareTo.balance.plus(
      tokenToDecimal(event.params.value.toBigDecimal(), 18)
    )
    poolShareTo.save()
    pool.totalShares = pool.totalShares.plus(
      tokenToDecimal(event.params.value.toBigDecimal(), 18)
    )
  } else if (isBurn) {
    if (poolShareFrom == null) {
      createPoolShareEntity(poolShareFromId, poolId, event.params.from.toHex())
      poolShareFrom = PoolShare.load(poolShareFromId)!
    }
    poolShareFrom.balance = poolShareFrom.balance.minus(
      tokenToDecimal(event.params.value.toBigDecimal(), 18)
    )
    poolShareFrom.save()
    pool.totalShares = pool.totalShares.minus(
      tokenToDecimal(event.params.value.toBigDecimal(), 18)
    )
  } else {
    if (poolShareTo == null) {
      createPoolShareEntity(poolShareToId, poolId, event.params.to.toHex())
      poolShareTo = PoolShare.load(poolShareToId)!
    }
    poolShareTo.balance = poolShareTo.balance.plus(
      tokenToDecimal(event.params.value.toBigDecimal(), 18)
    )
    poolShareTo.save()

    if (poolShareFrom == null) {
      createPoolShareEntity(poolShareFromId, poolId, event.params.from.toHex())
      poolShareFrom = PoolShare.load(poolShareFromId)!
    }
    poolShareFrom.balance = poolShareFrom.balance.minus(
      tokenToDecimal(event.params.value.toBigDecimal(), 18)
    )
    poolShareFrom.save()
  }

  if (
    poolShareTo !== null &&
    poolShareTo.balance.notEqual(ZERO_BD) &&
    poolShareToBalance.equals(ZERO_BD)
  ) {
    pool.holdersCount = pool.holdersCount.plus(BigInt.fromI32(1))
  }

  if (
    poolShareFrom !== null &&
    poolShareFrom.balance.equals(ZERO_BD) &&
    poolShareFromBalance.notEqual(ZERO_BD)
  ) {
    pool.holdersCount = pool.holdersCount.minus(BigInt.fromI32(1))
  }

  pool.save()
}
