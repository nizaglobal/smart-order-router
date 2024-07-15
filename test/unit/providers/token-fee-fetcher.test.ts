import { JsonRpcProvider } from '@ethersproject/providers';
import { ChainId, WETH9 } from '@nizaglobal/sdk-core';
import dotenv from 'dotenv';
import { ID_TO_PROVIDER } from '../../../src';
import {
  ITokenFeeFetcher,
  OnChainTokenFeeFetcher,
} from '../../../src/providers/token-fee-fetcher';
import { BITBOY } from '../../test-util/mock-data';

dotenv.config();

describe('TokenFeeFetcher', () => {
  let tokenFeeFetcher: ITokenFeeFetcher;

  beforeAll(async () => {
    const chain = ChainId.MAINNET;
    const chainProvider = ID_TO_PROVIDER(chain);
    const provider = new JsonRpcProvider(chainProvider, chain);

    tokenFeeFetcher = new OnChainTokenFeeFetcher(chain, provider);
  });

  it('Fetch WETH and BITBOY, should only return BITBOY', async () => {
    const tokenFeeMap = await tokenFeeFetcher.fetchFees([
      WETH9[ChainId.MAINNET]!.address,
      BITBOY.address,
    ]);
    expect(tokenFeeMap).not.toContain(WETH9[ChainId.MAINNET]!.address);
  });
});
