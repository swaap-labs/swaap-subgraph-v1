import {
  BigDecimal,
  Address,
  BigInt,
  Bytes,
  dataSource,
  ethereum,
} from '@graphprotocol/graph-ts'
import {
  SwaapProtocol,
  Pool,
  PoolShare,
  PoolToken,
  TokenPrice,
  Transaction,
  User,
  PoolOracleState
} from '../../generated/schema'
import { Token } from '../../generated/templates/Pool/Token'
import { TokenBytes } from '../../generated/templates/Pool/TokenBytes'
import { CRPFactory } from '../../generated/Factory/CRPFactory'
import { ConfigurableRightsPool } from '../../generated/Factory/ConfigurableRightsPool'
import { log } from '@graphprotocol/graph-ts/'
import {
  LOG_CALL,
} from '../../generated/templates/Pool/Pool'
export let ZERO_BD = BigDecimal.fromString('0')
import {
  EVENT_MSG_DATA_HEX_OFFSET,
  EVENT_MSG_DATA_HEX_ARG_LENGTH,
  EVENT_MSG_DATA_HEX_ADDRESS_OFFSET,
  PROTOCOL_DECIMALS
} from './constants'

let network = dataSource.network()

export function hexToInt(hexString: string): i32 {
  let bytes = Bytes.fromHexString(hexString).reverse() as Bytes
  log.warning("i32: {} {}", [bytes.toString(), bytes.toI32().toString()])
  return bytes.toI32()
}

export function hexToBigInt(hexString: string): BigInt {
  let bytes = Bytes.fromHexString(hexString).reverse() as Bytes
  return BigInt.fromUnsignedBytes(bytes)
}

export function hexToDecimal(hexString: string, decimals: i32): BigDecimal {
  let scale = BigInt.fromI32(10)
    .pow(decimals as u8)
    .toBigDecimal()
  return hexToBigInt(hexString).divDecimal(scale)
}

export function bigIntToDecimal(amount: BigInt, decimals: i32): BigDecimal {
  let scale = BigInt.fromI32(10)
    .pow(decimals as u8)
    .toBigDecimal()
  return amount.toBigDecimal().div(scale)
}

export function tokenToDecimal(amount: BigDecimal, decimals: i32): BigDecimal {
  let scale = BigInt.fromI32(10)
    .pow(decimals as u8)
    .toBigDecimal()
  return amount.div(scale)
}

export function createPoolShareEntity(
  id: string,
  pool: string,
  user: string
): void {
  let poolShare = new PoolShare(id)

  createUserEntity(user)

  poolShare.userAddress = user
  poolShare.poolId = pool
  poolShare.balance = ZERO_BD
  poolShare.save()
}

export function createPoolTokenEntity(
  id: string,
  pool: string,
  address: string
): void {
  let token = Token.bind(Address.fromString(address))
  let tokenBytes = TokenBytes.bind(Address.fromString(address))
  let symbol = ''
  let name = ''
  let decimals = PROTOCOL_DECIMALS

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

  // !!! COMMENT THE LINES ABOVE OUT FOR NON-LOCAL DEPLOYMENT

  let poolToken = new PoolToken(id)
  poolToken.poolId = pool
  poolToken.address = address
  poolToken.name = name
  poolToken.symbol = symbol
  poolToken.decimals = decimals
  poolToken.balance = ZERO_BD
  poolToken.denormWeight = ZERO_BD

  poolToken.save()
}

export function createPoolOracleStateEntity(
  id: string,
  oracleAddress: string,
  description: string,
  price: BigInt,
  decimals: i32
): void {
  let poolOracleInitialState = new PoolOracleState(id)
  poolOracleInitialState.proxy = oracleAddress
  poolOracleInitialState.description = description
  poolOracleInitialState.fixedPointPrice = price
  poolOracleInitialState.decimals = decimals
  poolOracleInitialState.save()
}

export function updatePoolLiquidity(id: string): void {
  let pool = Pool.load(id)!
  let tokensList: Array<Bytes> = pool.tokensList

  if (pool.tokensCount.equals(BigInt.fromI32(0))) {
    pool.liquidity = ZERO_BD
    pool.save()
    log.warning('POOL updatePoolLiquidity : pool tokens count == 0', [])
    return
  }

  if (
    !tokensList
  ) {
    log.warning(
      'POOL updatePoolLiquidity : no token list {}',
      [id]
    )
    return
  }

  if (
    pool.tokensCount.lt(BigInt.fromI32(2))
  ) {
    log.warning(
      'POOL updatePoolLiquidity : single asset {}',
      [id]
    )
    return
  }

  if (
    !pool.publicSwap
  ) {
    log.warning(
      'POOL updatePoolLiquidity : not public {}',
      [id]
    )
    return
  }

  // Update pool liquidity

  let liquidity = ZERO_BD

  for (let i: i32 = 0; i < tokensList.length; i++) {
    let token = tokensList[i].toHexString()
    let poolOracleStateId = id.concat('-').concat(token)
    let poolOracleInitialState = PoolOracleState.load(poolOracleStateId)
    if (poolOracleInitialState == null) {
      log.error('LOGIC updatePoolLiquidity: null PoolOracleState with id {}', [
        poolOracleStateId,
      ])
    } else {
    let tokenPriceId = token.concat('-').concat(poolOracleInitialState.proxy)
    let tokenPrice = TokenPrice.load(tokenPriceId)
    if (tokenPrice !== null) {
      let poolTokenId = id.concat('-').concat(token)
      let poolToken = PoolToken.load(poolTokenId)!
      if (
        tokenPrice.price.gt(ZERO_BD)
      ) {
        liquidity = liquidity.plus(tokenPrice.price.times(poolToken.balance))
      }
    } else {
      log.info('PRICE: no token price set yet for token {}', [tokenPriceId])
    }
    }
  }

  let factory = SwaapProtocol.load(pool.factoryID)!
  factory.totalLiquidity = factory.totalLiquidity
    .minus(pool.liquidity)
    .plus(liquidity)
  factory.save()

  pool.liquidity = liquidity
  pool.save()
}

export function parseEvent256BitsSlot(event: LOG_CALL, slotIndex: i32, slotOffset: i32 = 0): string {
  return event.params.data.toHexString().slice(
    EVENT_MSG_DATA_HEX_OFFSET + EVENT_MSG_DATA_HEX_ARG_LENGTH * slotIndex + slotOffset,
    EVENT_MSG_DATA_HEX_OFFSET + EVENT_MSG_DATA_HEX_ARG_LENGTH * (slotIndex + 1)
  )
}

export function parseEventAddressSlot(event: LOG_CALL, slotIndex: i32): string {
  return parseEvent256BitsSlot(
    event,
    slotIndex,
    EVENT_MSG_DATA_HEX_ADDRESS_OFFSET,
  )
}

export function decrPoolCount(
  factoryID: string,
  active: boolean,
  finalized: boolean,
  crp: boolean
): void {
  if (active) {
    let factory = SwaapProtocol.load(factoryID)!
    factory.poolCount = factory.poolCount - 1
    if (finalized) factory.finalizedPoolCount = factory.finalizedPoolCount - 1
    if (crp) factory.crpCount = factory.crpCount - 1
    factory.save()
  }
}

export function saveTransaction(
  event: ethereum.Event,
   eventName: string
): void {
  let tx = event.transaction.hash.toHexString().concat('-').concat(event.logIndex.toString())
  let userAddress = event.transaction.from.toHex()
  let transaction = Transaction.load(tx)
  if (transaction == null) {
    transaction = new Transaction(tx)
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
  return false
//   let crpFactory = CRPFactory.bind(Address.fromString(CRP_FACTORY))
//   let isCrp = crpFactory.try_isCrp(address)
//   if (isCrp.reverted) return false
//   return isCrp.value
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
