import { RvnCoinService } from './coin.service';

describe('RvnCoinService', () => {
  let service: RvnCoinService;

  beforeAll(() => {
    service = new RvnCoinService();
  });

  it('should create address', async () => {
    const result = await service.addressCreate();
    expect(result.address).toBeDefined();
    expect(result.mnemonic).toBeDefined();
    expect(result.privateKey).toBeDefined();
    expect(result.publicKey).toBeDefined();
  });

  it('should validate address', () => {
    const valid = service.addressValidate('RBahQFC6Sj7WaL92vY2uDRSWnVsa7TKf8X');
    expect(valid.valid).toBe(true);

    const invalid = service.addressValidate('invalid_address');
    expect(invalid.valid).toBe(false);
  });
});
