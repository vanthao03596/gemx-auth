import { createPublicClient, http, PublicClient } from 'viem';
import { mainnet, sepolia } from 'viem/chains';
import { env } from './env';

const getChain = () => {
  switch (env.CHAIN_ID) {
    case 1:
      return mainnet;
    case 11155111:
      return sepolia;
    default:
      return mainnet;
  }
};

const createSiweClient = (): PublicClient => {
  return createPublicClient({
    chain: getChain(),
    transport: http(env.RPC_URL),
  });
};

export const siweClient = createSiweClient();

export const getSiweChainId = (): number => env.CHAIN_ID;
export const getSiweDomains = (): string[] => env.SIWE_DOMAINS;
export const isValidSiweDomain = (domain: string): boolean => env.SIWE_DOMAINS.includes(domain);