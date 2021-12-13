import { Token, WETH9 } from '@uniswap/sdk-core';
import { FeeAmount, Pool } from '@uniswap/v3-sdk';
import _ from 'lodash';
import { unparseFeeAmount } from '../../util/amounts';
import { ChainId } from '../../util/chains';
import { log } from '../../util/log';
import {
  DAI_ARBITRUM,
  DAI_ARBITRUM_RINKEBY,
  DAI_GÖRLI,
  DAI_KOVAN,
  DAI_MAINNET,
  DAI_OPTIMISM,
  DAI_OPTIMISTIC_KOVAN,
  DAI_RINKEBY_1,
  DAI_RINKEBY_2,
  DAI_ROPSTEN,
  UNI_ARBITRUM_RINKEBY,
  USDC_ARBITRUM,
  USDC_GÖRLI,
  USDC_KOVAN,
  USDC_MAINNET,
  USDC_OPTIMISM,
  USDC_OPTIMISTIC_KOVAN,
  USDC_RINKEBY,
  USDC_ROPSTEN,
  USDT_ARBITRUM,
  USDT_ARBITRUM_RINKEBY,
  USDT_GÖRLI,
  USDT_KOVAN,
  USDT_MAINNET,
  USDT_OPTIMISM,
  USDT_OPTIMISTIC_KOVAN,
  USDT_RINKEBY,
  USDT_ROPSTEN,
  WBTC_ARBITRUM,
  WBTC_GÖRLI,
  WBTC_KOVAN,
  WBTC_MAINNET,
  WBTC_OPTIMISM,
  WBTC_OPTIMISTIC_KOVAN,
} from '../token-provider';
import { IV3SubgraphProvider, V3SubgraphPool } from './subgraph-provider';

type ChainTokenList = {
  readonly [chainId in ChainId]: Token[];
};

const BASES_TO_CHECK_TRADES_AGAINST: ChainTokenList = {
  [ChainId.MAINNET]: [
    WETH9[ChainId.MAINNET]!,
    DAI_MAINNET,
    USDC_MAINNET,
    USDT_MAINNET,
    WBTC_MAINNET,
  ],
  [ChainId.ROPSTEN]: [
    WETH9[ChainId.ROPSTEN]!,
    DAI_ROPSTEN,
    USDT_ROPSTEN,
    USDC_ROPSTEN,
  ],
  [ChainId.RINKEBY]: [
    WETH9[ChainId.RINKEBY]!,
    DAI_RINKEBY_1,
    DAI_RINKEBY_2,
    USDC_RINKEBY,
    USDT_RINKEBY,
  ],
  [ChainId.GÖRLI]: [
    WETH9[ChainId.GÖRLI]!,
    USDT_GÖRLI,
    USDC_GÖRLI,
    WBTC_GÖRLI,
    DAI_GÖRLI,
  ],
  [ChainId.KOVAN]: [
    WETH9[ChainId.KOVAN]!,
    USDC_KOVAN,
    USDT_KOVAN,
    WBTC_KOVAN,
    DAI_KOVAN,
  ],
  [ChainId.OPTIMISM]: [
    WETH9[ChainId.OPTIMISM]!,
    USDC_OPTIMISM,
    DAI_OPTIMISM,
    USDT_OPTIMISM,
    WBTC_OPTIMISM,
  ],
  [ChainId.ARBITRUM_ONE]: [
    WETH9[ChainId.ARBITRUM_ONE]!,
    WBTC_ARBITRUM,
    DAI_ARBITRUM,
    USDC_ARBITRUM,
    USDT_ARBITRUM,
  ],
  [ChainId.ARBITRUM_RINKEBY]: [
    WETH9[ChainId.ARBITRUM_RINKEBY]!,
    DAI_ARBITRUM_RINKEBY,
    UNI_ARBITRUM_RINKEBY,
    USDT_ARBITRUM_RINKEBY,
  ],
  [ChainId.OPTIMISTIC_KOVAN]: [
    WETH9[ChainId.OPTIMISTIC_KOVAN]!,
    DAI_OPTIMISTIC_KOVAN,
    WBTC_OPTIMISTIC_KOVAN,
    USDT_OPTIMISTIC_KOVAN,
    USDC_OPTIMISTIC_KOVAN,
  ],
};

/**
 * Provider that does not get data from an external source and instead returns
 * a hardcoded list of Subgraph pools.
 *
 * Since the pools are hardcoded, the liquidity/price values are dummys and should not
 * be depended on.
 *
 * Useful for instances where other data sources are unavailable. E.g. subgraph not available.
 *
 * @export
 * @class StaticV3SubgraphProvider
 */
export class StaticV3SubgraphProvider implements IV3SubgraphProvider {
  constructor(private chainId: ChainId) {}

  public async getPools(
    tokenIn?: Token,
    tokenOut?: Token
  ): Promise<V3SubgraphPool[]> {
    log.info('In static subgraph provider for V3');
    const bases = BASES_TO_CHECK_TRADES_AGAINST[this.chainId];

    let basePairs: [Token, Token][] = _.flatMap(
      bases,
      (base): [Token, Token][] => bases.map((otherBase) => [base, otherBase])
    );

    if (tokenIn && tokenOut) {
      basePairs.push(
        [tokenIn, tokenOut],
        ...bases.map((base): [Token, Token] => [tokenIn, base]),
        ...bases.map((base): [Token, Token] => [tokenOut, base])
      );
    }

    const pairs: [Token, Token, FeeAmount][] = _(basePairs)
      .filter((tokens): tokens is [Token, Token] =>
        Boolean(tokens[0] && tokens[1])
      )
      .filter(
        ([tokenA, tokenB]) =>
          tokenA.address !== tokenB.address && !tokenA.equals(tokenB)
      )
      .flatMap<[Token, Token, FeeAmount]>(([tokenA, tokenB]) => {
        return [
          [tokenA, tokenB, FeeAmount.LOWEST],
          [tokenA, tokenB, FeeAmount.LOW],
          [tokenA, tokenB, FeeAmount.MEDIUM],
          [tokenA, tokenB, FeeAmount.HIGH],
        ];
      })
      .value();

    const poolAddressSet = new Set<string>();

    const subgraphPools: V3SubgraphPool[] = _(pairs)
      .map(([tokenA, tokenB, fee]) => {
        const poolAddress = Pool.getAddress(tokenA, tokenB, fee);
        const [token0, token1] = tokenA.sortsBefore(tokenB)
          ? [tokenA, tokenB]
          : [tokenB, tokenA];

        if (poolAddressSet.has(poolAddress)) {
          return undefined;
        }
        poolAddressSet.add(poolAddress);

        return {
          id: poolAddress,
          feeTier: unparseFeeAmount(fee),
          liquidity: '100',
          token0: {
            id: token0.address,
          },
          token1: {
            id: token1.address,
          },
          tvlETH: 100,
          tvlUSD: 100,
        };
      })
      .compact()
      .value();

    return subgraphPools;
  }
}