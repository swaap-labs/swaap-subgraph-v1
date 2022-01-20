import {
  BigDecimal,
  Address,
  BigInt,
  Bytes,
  dataSource,
  ethereum
} from '@graphprotocol/graph-ts'
import {Balancer, Pool, PoolShare, PoolToken, TokenPrice, Transaction, User} from '../../generated/schema'
import {BToken} from '../../generated/templates/Pool/BToken'
import {BTokenBytes} from '../../generated/templates/Pool/BTokenBytes'
import {CRPFactory} from '../../generated/Factory/CRPFactory'
import {ConfigurableRightsPool} from '../../generated/Factory/ConfigurableRightsPool'
import {log} from '@graphprotocol/graph-ts/'

export let ZERO_BD = BigDecimal.fromString('0')

let network = dataSource.network()

// Config for mainnet
let WETH = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2'
let USD = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'
let DAI = '0x6b175474e89094c44da98b954eedeac495271d0f'
let CRP_FACTORY = '0xed52D8E202401645eDAD1c0AA21e872498ce47D0'
let WBTC = ''

if (network == 'kovan') {
  WETH = '0xd0a1e359811322d97991e03f863a0c30c2cf029c'
  USD = '0x2f375e94fc336cdec2dc0ccb5277fe59cbf1cae5'
  DAI = '0x1528f3fcc26d13f7079325fb78d9442607781c8c'
  CRP_FACTORY = '0x53265f0e014995363AE54DAd7059c018BaDbcD74'
}

// TODO: Nik we are on rinkeby - this is awful programming, just testing
if (network == 'rinkeby' || true) {
  WETH = '0x4848683f3cC566E3588bFd6953FaAA7176968965'.toLowerCase()
  USD = '0x0aBABf7Cd9De9508D1B69B2dd2d374fA88d384d3'.toLowerCase()
  DAI = '0x0aBABf7Cd9De9508D1B69B2dd2d374fA88d384d3'.toLowerCase()
  WBTC = '0xead28cb59D01ad96c9CEEb486380FB514253f8eD'.toLowerCase()
  CRP_FACTORY = '0xA3F9145CB0B50D907930840BB2dcfF4146df8Ab4'.toLowerCase()
}

export function hexToDecimal(hexString: string, decimals: i32): BigDecimal {
  let bytes = Bytes.fromHexString(hexString).reverse() as Bytes
  let bi = BigInt.fromUnsignedBytes(bytes)
  let scale = BigInt.fromI32(10).pow(decimals as u8).toBigDecimal()
  return bi.divDecimal(scale)
}

export function bigIntToDecimal(amount: BigInt, decimals: i32): BigDecimal {
  let scale = BigInt.fromI32(10).pow(decimals as u8).toBigDecimal()
  return amount.toBigDecimal().div(scale)
}

export function tokenToDecimal(amount: BigDecimal, decimals: i32): BigDecimal {
  let scale = BigInt.fromI32(10).pow(decimals as u8).toBigDecimal()
  return amount.div(scale)
}

export function createPoolShareEntity(id: string, pool: string, user: string): void {
  let poolShare = new PoolShare(id)

  createUserEntity(user)

  poolShare.userAddress = user
  poolShare.poolId = pool
  poolShare.balance = ZERO_BD
  poolShare.save()
}

export function createPoolTokenEntity(id: string, pool: string, address: string): void {
  log.warning('NIK PRICE : Creating PoolToken from address {} - {}, {}, {}', [getSymbol(address), id, pool, address])
  let token = BToken.bind(Address.fromString(address))
  let tokenBytes = BTokenBytes.bind(Address.fromString(address))
  let symbol = ''
  let name = ''
  let decimals = 18

  // COMMENT THE LINES BELOW OUT FOR LOCAL DEV ON KOVAN

  let symbolCall = token.try_symbol()
  let nameCall = token.try_name()
  let decimalCall = token.try_decimals()

  if (symbolCall.reverted) {
    let symbolBytesCall = tokenBytes.try_symbol()
    if (!symbolBytesCall.reverted) {
      symbol = symbolBytesCall.value.toString()
    }
  } else {
    symbol = symbolCall.value
  }

  if (nameCall.reverted) {
    let nameBytesCall = tokenBytes.try_name()
    if (!nameBytesCall.reverted) {
      name = nameBytesCall.value.toString()
    }
  } else {
    name = nameCall.value
  }

  if (!decimalCall.reverted) {
    decimals = decimalCall.value
  }

  // COMMENT THE LINES ABOVE OUT FOR LOCAL DEV ON KOVAN

  // !!! COMMENT THE LINES BELOW OUT FOR NON-LOCAL DEPLOYMENT
  // This code allows Symbols to be added when testing on local Kovan
  /*
  if(address == '0xd0a1e359811322d97991e03f863a0c30c2cf029c')
    symbol = 'WETH';
  else if(address == '0x1528f3fcc26d13f7079325fb78d9442607781c8c')
    symbol = 'DAI'
  else if(address == '0xef13c0c8abcaf5767160018d268f9697ae4f5375')
    symbol = 'MKR'
  else if(address == '0x2f375e94fc336cdec2dc0ccb5277fe59cbf1cae5')
    symbol = 'USDC'
  else if(address == '0x1f1f156e0317167c11aa412e3d1435ea29dc3cce')
    symbol = 'BAT'
  else if(address == '0x86436bce20258a6dcfe48c9512d4d49a30c4d8c4')
    symbol = 'SNX'
  else if(address == '0x8c9e6c40d3402480ace624730524facc5482798c')
    symbol = 'REP'
  */
  // !!! COMMENT THE LINES ABOVE OUT FOR NON-LOCAL DEPLOYMENT

  // On Swaap Rinkeby
  if (address == WETH)
    symbol = 'WETH'
  else if (address == DAI)
    symbol = 'DAI'
  else if (address == WBTC)
    symbol = 'WBTC'
  else {
    log.error('NIK PRICE : helpers-137 ; cant find preset token address {}', [address])
  }


  let poolToken = new PoolToken(id)
  poolToken.poolId = pool
  poolToken.address = address
  poolToken.name = name
  poolToken.symbol = symbol
  poolToken.decimals = decimals
  poolToken.balance = ZERO_BD
  poolToken.denormWeight = ZERO_BD

  log.warning('NIK PRICE : saving poolToken in poolId {} as {}', [pool, symbol])
  poolToken.save()
}

export function updatePoolLiquidity(id: string): void {
  log.warning('NIK PRICE: Updating pool liquidity {}', [id])
  let pool = Pool.load(id)!
  let tokensList: Array<Bytes> = pool.tokensList

  if (pool.tokensCount.equals(BigInt.fromI32(0))) {
    pool.liquidity = ZERO_BD
    pool.save()
    log.warning('NIK PRICE : pool tokens count == 0', [])
    return
  }

  if (!tokensList || pool.tokensCount.lt(BigInt.fromI32(2)) || !pool.publicSwap) {
    log.warning('NIK PRICE : no token list, or single asset or not public', [])
    return
  } else {
    log.warning('NIK PRICE : working on {}-{}', [tokensList[0].toHexString(), tokensList[1].toHexString()])
  }

  // Find pool liquidity

  let hasPrice = false
  let hasUsdPrice = false
  let poolLiquidity = ZERO_BD

  if (tokensList.includes(Address.fromString(USD))) {
    let usdPoolTokenId = id.concat('-').concat(USD)
    let usdPoolToken = PoolToken.load(usdPoolTokenId)
    if (usdPoolToken == null) {
      log.error('NIK PRICE : cant find USD poolToken {}', [usdPoolTokenId])
      //log.critical("USD Pool token not found", [])
      return
    }
    poolLiquidity = usdPoolToken.balance.div(usdPoolToken.denormWeight).times(pool.totalWeight)
    hasPrice = true
    hasUsdPrice = true
  } else if (tokensList.includes(Address.fromString(WETH))) {
    let wethTokenPrice = TokenPrice.load(WETH)
    if (wethTokenPrice !== null) {
      let poolTokenId = id.concat('-').concat(WETH)
      let poolToken = PoolToken.load(poolTokenId)!
      poolLiquidity = wethTokenPrice.price.times(poolToken.balance).div(poolToken.denormWeight).times(pool.totalWeight)
      hasPrice = true
    } else {
      log.error('NIK PRICE: WETH price not found', [])
    }
  } else if (tokensList.includes(Address.fromString(DAI))) {
    let daiTokenPrice = TokenPrice.load(DAI)
    if (daiTokenPrice !== null) {
      let poolTokenId = id.concat('-').concat(DAI)
      let poolToken = PoolToken.load(poolTokenId)!
      poolLiquidity = daiTokenPrice.price.times(poolToken.balance).div(poolToken.denormWeight).times(pool.totalWeight)
      hasPrice = true
    } else {
      log.error('NIK PRICE: DAI price not found', [])
    }
  }

  // Create or update token price

  if (hasPrice) {
    for (let i: i32 = 0; i < tokensList.length; i++) {
      let tokenPriceId = tokensList[i].toHexString()
      let tokenPrice = TokenPrice.load(tokenPriceId)
      if (tokenPrice == null) {
        tokenPrice = new TokenPrice(tokenPriceId)
        tokenPrice.poolTokenId = ''
        tokenPrice.poolLiquidity = ZERO_BD
      }

      let poolTokenId = id.concat('-').concat(tokenPriceId)
      let poolToken = PoolToken.load(poolTokenId)!

      if (
        pool.active && !pool.crp && pool.tokensCount.notEqual(BigInt.fromI32(0)) && pool.publicSwap &&
        (tokenPrice.poolTokenId == poolTokenId || poolLiquidity.gt(tokenPrice.poolLiquidity)) &&
        (
          (tokenPriceId != WETH.toString() && tokenPriceId != DAI.toString()) ||
          (pool.tokensCount.equals(BigInt.fromI32(2)) && hasUsdPrice)
        )
      ) {
        tokenPrice.price = ZERO_BD

        if (poolToken.balance.gt(ZERO_BD)) {
          tokenPrice.price = poolLiquidity.div(pool.totalWeight).times(poolToken.denormWeight).div(poolToken.balance)
        }

        tokenPrice.symbol = poolToken.symbol
        tokenPrice.name = poolToken.name
        tokenPrice.decimals = poolToken.decimals
        tokenPrice.poolLiquidity = poolLiquidity
        tokenPrice.poolTokenId = poolTokenId
        tokenPrice.save()
      }
    }
  }

  // Update pool liquidity

  let liquidity = ZERO_BD
  let denormWeight = ZERO_BD

  for (let i: i32 = 0; i < tokensList.length; i++) {
    let tokenPriceId = tokensList[i].toHexString()
    let tokenPrice = TokenPrice.load(tokenPriceId)
    if (tokenPrice !== null) {
      let poolTokenId = id.concat('-').concat(tokenPriceId)
      let poolToken = PoolToken.load(poolTokenId)!
      if (tokenPrice.price.gt(ZERO_BD) && poolToken.denormWeight.gt(denormWeight)) {
        denormWeight = poolToken.denormWeight
        liquidity = tokenPrice.price.times(poolToken.balance).div(poolToken.denormWeight).times(pool.totalWeight)
      }
    } else {
      log.warning('NIK: no token price set yet for token {}', [tokenPriceId])
    }
  }

  let factory = Balancer.load('1')!
  factory.totalLiquidity = factory.totalLiquidity.minus(pool.liquidity).plus(liquidity)
  factory.save()

  pool.liquidity = liquidity
  pool.save()
}

export function decrPoolCount(active: boolean, finalized: boolean, crp: boolean): void {
  if (active) {
    let factory = Balancer.load('1')!
    factory.poolCount = factory.poolCount - 1
    if (finalized) factory.finalizedPoolCount = factory.finalizedPoolCount - 1
    if (crp) factory.crpCount = factory.crpCount - 1
    factory.save()
  }
}

export function saveTransaction(event: ethereum.Event, eventName: string): void {
  let tx = event.transaction.hash.toHexString().concat('-').concat(event.logIndex.toString())
  let userAddress = event.transaction.from.toHex()
  let transaction = Transaction.load(tx)
  if (transaction == null) {
    transaction = new Transaction(tx)
    log.warning('NIK : creating a new transaction object, tx ({}) not found', [tx])
  } else {
    log.warning('NIK : transaction object ({}) retrieved', [tx])
  }
  transaction.event = eventName
  transaction.poolAddress = event.address.toHex()
  transaction.userAddress = userAddress
  //transaction.gasUsed = txObject.gasUsed.toBigDecimal()
  transaction.gasPrice = event.transaction.gasPrice.toBigDecimal()
  transaction.tx = event.transaction.hash
  transaction.timestamp = event.block.timestamp.toI32()
  transaction.block = event.block.number.toI32()
  transaction.save()

  createUserEntity(userAddress)
}

export function createUserEntity(address: string): void {
  if (User.load(address) == null) {
    let user = new User(address)
    user.save()
  }
}

export function isCrp(address: Address): boolean {
  let crpFactory = CRPFactory.bind(Address.fromString(CRP_FACTORY))
  let isCrp = crpFactory.try_isCrp(address)
  if (isCrp.reverted) return false
  return isCrp.value
}

// TODO NZ: There must be edge case where the return value is null
export function getCrpUnderlyingPool(crp: ConfigurableRightsPool): string {
  let bPool = crp.try_bPool()
  if (bPool.reverted) return '' // changed null by ""
  return bPool.value.toHexString()
}

// TODO NZ: There must be edge case where the return value is null
export function getCrpController(crp: ConfigurableRightsPool): string | null {
  let controller = crp.try_getController()
  if (controller.reverted) return null
  return controller.value.toHexString()
}

export function getCrpSymbol(crp: ConfigurableRightsPool): string {
  let symbol = crp.try_symbol()
  if (symbol.reverted) return ''
  return symbol.value
}

export function getCrpName(crp: ConfigurableRightsPool): string {
  let name = crp.try_name()
  if (name.reverted) return ''
  return name.value
}

export function getCrpCap(crp: ConfigurableRightsPool): BigInt {
  let cap = crp.try_getCap()
  if (cap.reverted) return BigInt.fromI32(0)
  return cap.value
}

export function getCrpRights(crp: ConfigurableRightsPool): string[] {
  let rights = crp.try_rights()
  if (rights.reverted) return []
  let rightsArr: string[] = []
  if (rights.value.value0) rightsArr.push('canPauseSwapping')
  if (rights.value.value1) rightsArr.push('canChangeSwapFee')
  if (rights.value.value2) rightsArr.push('canChangeWeights')
  if (rights.value.value3) rightsArr.push('canAddRemoveTokens')
  if (rights.value.value4) rightsArr.push('canWhitelistLPs')
  if (rights.value.value5) rightsArr.push('canChangeCap')
  return rightsArr
}

function getSymbol(address: string): string {

  if (address == WETH) return 'WETH'
  if (address == USD) return 'DAI'
  if (address == DAI) return 'DAI'
  if (address == WBTC) return 'WBTC'

  if (address.includes('-')) {
    return 'Composed'
  }
  return 'Unknown'
}