import { Decimal } from "./Decimal";
import { Fees } from "./Fees";
import { KUMOStake } from "./KUMOStake";
import { StabilityDeposit } from "./StabilityDeposit";
import { Trove, TroveWithPendingRedistribution, UserTrove } from "./Trove";


/**
 * A Vault that is associated with each asset.
 * @public
 */
export class Vault {
  readonly asset: string;
  readonly assetAddress: string;
  readonly assetName: string;
  readonly numberOfTroves: number;
  readonly totalRedistributed: Trove;
  readonly total: Trove;
  readonly kusdInStabilityPool: Decimal;
  readonly price: Decimal;
  readonly _riskiestTroveBeforeRedistribution: TroveWithPendingRedistribution;
  readonly accountBalance: Decimal;
  readonly collateralSurplusBalance: Decimal;
  readonly troveBeforeRedistribution: TroveWithPendingRedistribution;
  readonly stabilityDeposit: StabilityDeposit;
  readonly kumoStake: KUMOStake;
  readonly kusdMintedCap: Decimal;
  readonly minNetDebt: Decimal;
  readonly _feesInNormalMode: Fees;
  readonly trove: UserTrove;
  readonly fees: Fees;
  readonly borrowingRate: Decimal;
  readonly redemptionRate: Decimal;
  readonly haveUndercollateralizedTroves: boolean;
  readonly testTokensTransfered : boolean;

  constructor() {
    this.asset = "";
    this.assetAddress = "";
    this.assetName = "",
    this.numberOfTroves = 0;
    this.totalRedistributed = new Trove();
    this.total = new Trove();
    this.kusdInStabilityPool = Decimal.ZERO;
    this.price = Decimal.ZERO;
    this._riskiestTroveBeforeRedistribution = new TroveWithPendingRedistribution("", "nonExistent");
    this.accountBalance = Decimal.ZERO;
    this.collateralSurplusBalance = Decimal.ZERO;
    this.troveBeforeRedistribution = new TroveWithPendingRedistribution("", "nonExistent");
    this.stabilityDeposit = new StabilityDeposit(
      Decimal.ZERO,
      Decimal.ZERO,
      Decimal.ZERO,
      Decimal.ZERO,
    );
    this.kumoStake = new KUMOStake();
    this.kusdMintedCap = Decimal.ZERO;
    this.minNetDebt = Decimal.ZERO;
    this._feesInNormalMode = new Fees(0, 0, 0, new Date(), new Date(), false);
    this.trove = new UserTrove("", "nonExistent");
    this.fees = new Fees(0, 0, 0, new Date(), new Date(), false);
    this.borrowingRate = Decimal.ZERO;
    this.redemptionRate = Decimal.ZERO;
    this.haveUndercollateralizedTroves = false;
    this.testTokensTransfered = false;
  }
}
