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
  Pool as BPool,
  Transfer,
} from '../../generated/templates/Pool/Pool'
import { log } from '@graphprotocol/graph-ts/'

import {
  hexToDecimal,
  bigIntToDecimal,
  tokenToDecimal,
  createPoolShareEntity,
  createPoolTokenEntity,
  updatePoolLiquidity,
  getCrpUnderlyingPool,
  saveTransaction,
  ZERO_BD,
  decrPoolCount,
} from './helpers'
import {
  Balancer,
  Pool,
  PoolShare,
  PoolToken,
  Swap,
  TokenPrice,
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
  let swapFee = hexToDecimal(event.params.data.toHexString().slice(-40), 18)
  pool.swapFee = swapFee
  pool.save()

  saveTransaction(event, 'setSwapFee')
}

export function handleSetController(event: LOG_CALL): void {
  let poolId = event.address.toHex()
  let pool = Pool.load(poolId)!
  let controller = Address.fromString(
    event.params.data.toHexString().slice(-40)
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
  pool.symbol = 'BPT'
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

  let factory = Balancer.load('1')!
  factory.finalizedPoolCount = factory.finalizedPoolCount + 1
  factory.save()
  saveTransaction(event, 'finalize')
}

export function handleRebind(event: LOG_CALL): void {
  let poolId = event.address.toHex()
  let pool = Pool.load(poolId)!
  let tokenBytes = Bytes.fromHexString(
    event.params.data.toHexString().slice(34, 74)
  ) as Bytes
  let tokensList = pool.tokensList || []
  if (tokensList.indexOf(tokenBytes) == -1) {
    tokensList.push(tokenBytes)
  }
  pool.tokensList = tokensList
  pool.tokensCount = BigInt.fromI32(tokensList.length)

  let address = Address.fromString(
    event.params.data.toHexString().slice(34, 74)
  )
  let denormWeight = hexToDecimal(
    event.params.data.toHexString().slice(138),
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
    event.params.data.toHexString().slice(74, 138),
    poolToken.decimals
  )

  poolToken.balance = balance
  poolToken.denormWeight = denormWeight

  poolToken.save()

  if (balance.equals(ZERO_BD)) {
    decrPoolCount(pool.active, pool.finalized, pool.crp)
    pool.active = false
  }
  pool.save()

  updatePoolLiquidity(poolId)
  saveTransaction(event, 'rebind')
}

export function handleUnbind(event: LOG_CALL): void {
  let poolId = event.address.toHex()
  let pool = Pool.load(poolId)!
  let tokenBytes = Bytes.fromHexString(
    event.params.data.toHexString().slice(-40)
  ) as Bytes
  let tokensList = pool.tokensList || []
  let index = tokensList.indexOf(tokenBytes)
  tokensList.splice(index, 1)
  pool.tokensList = tokensList
  pool.tokensCount = BigInt.fromI32(tokensList.length)

  let address = Address.fromString(event.params.data.toHexString().slice(-40))
  let poolTokenId = poolId.concat('-').concat(address.toHexString())
  let poolToken = PoolToken.load(poolTokenId)!
  pool.totalWeight = pool.totalWeight.minus(poolToken.denormWeight)
  pool.save()
  store.remove('PoolToken', poolTokenId)

  updatePoolLiquidity(poolId)
  saveTransaction(event, 'unbind')
}

export function handleGulp(call: GulpCall): void {
  log.warning('GULP : Entering handleGulp', [])
  let poolId = call.to.toHexString()
  let pool = Pool.load(poolId)!

  let address = call.inputs.token.toHexString()

  let bpool = BPool.bind(Address.fromString(poolId))
  let balanceCall = bpool.try_getBalance(Address.fromString(address))

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
  let tokensList: Array<Bytes> = pool.tokensList

  const spread = event.params.spread
    .toBigDecimal()
    .div(BigDecimal.fromString('1e15'))

  // removed fees in multiple tokens

  let tokenOutPriceValue = ZERO_BD
  let tokenOutPrice = TokenPrice.load(tokenOut)

  if (tokenOutPrice != null) {
    tokenOutPriceValue = tokenOutPrice.price
  } else {
    for (let i: i32 = 0; i < tokensList.length; i++) {
      let tokenPriceId = tokensList[i].toHexString()
      if (!tokenOutPriceValue.gt(ZERO_BD) && tokenPriceId !== tokenOut) {
        let tokenPrice = TokenPrice.load(tokenPriceId)
        if (tokenPrice !== null && tokenPrice.price.gt(ZERO_BD)) {
          let poolTokenId = poolId.concat('-').concat(tokenPriceId)
          let poolToken = PoolToken.load(poolTokenId)!
          tokenOutPriceValue = tokenPrice.price
            .times(poolToken.balance)
            .div(poolToken.denormWeight)
            .times(poolTokenOut.denormWeight)
            .div(poolTokenOut.balance)
        }
      }
    }
  }

  let totalSwapVolume = pool.totalSwapVolume
  let totalSwapFee = pool.totalSwapFee
  let liquidity = pool.liquidity
  let swapValue = ZERO_BD
  let swapFeeValue = ZERO_BD
  let factory = Balancer.load('1')!

  if (tokenOutPriceValue.gt(ZERO_BD)) {
    swapValue = tokenOutPriceValue.times(tokenAmountOut)
    // without spread : swapFeeValue = swapValue.times(pool.swapFee)
    // fees = swapValue * (spread+fee)
    swapFeeValue = swapValue
      .times(pool.swapFee.plus(spread))
      .div(BigDecimal.fromString('100'))
    totalSwapVolume = totalSwapVolume.plus(swapValue)
    totalSwapFee = totalSwapFee.plus(swapFeeValue)

    factory.totalSwapVolume = factory.totalSwapVolume.plus(swapValue)
    factory.totalSwapFee = factory.totalSwapFee.plus(swapFeeValue)

    pool.totalSwapVolume = totalSwapVolume
    pool.totalSwapFee = totalSwapFee
  } else {
    log.error('SPREAD : Has no price with tokens {} - {}', [
      poolTokenIn.symbol!,
      poolTokenOut.symbol!,
    ])
  }

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
  swap.tokenOutSym = poolTokenOut.symbol!
  swap.tokenAmountIn = tokenAmountIn
  swap.tokenAmountOut = tokenAmountOut
  swap.poolAddress = event.address.toHex()
  swap.userAddress = event.transaction.from.toHex()
  swap.poolTotalSwapVolume = totalSwapVolume
  swap.poolTotalSwapFee = totalSwapFee
  swap.poolLiquidity = liquidity
  swap.value = swapValue
  swap.feeValue = swapFeeValue
  swap.timestamp = event.block.timestamp.toI32()

  //swap.save()
  addSwap(pool, swap, event)

  saveTransaction(event, 'swap')
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
