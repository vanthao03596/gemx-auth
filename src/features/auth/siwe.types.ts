export interface SiweNonceResponse {
  nonce: string;
}

export interface SiweVerifyInput {
  message: string;    // EIP-4361 formatted message
  signature: string;  // Hex signature from wallet
}

export interface SiweMessage {
  domain: string;
  address: string;
  uri: string;
  version: string;
  chainId: number;
  nonce: string;
  issuedAt: string;
}