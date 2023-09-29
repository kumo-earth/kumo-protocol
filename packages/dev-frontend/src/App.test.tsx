import { Decimal, KUSD_MINIMUM_NET_DEBT, Trove } from "@kumodao/lib-base";

const params = { depositCollateral: Decimal.from(20), borrowKUSD: KUSD_MINIMUM_NET_DEBT };
const trove = Trove.create(params);

console.log(`${trove}`);

/*
 * Just a quick and dirty testcase to prove that the approach can work in our CI pipeline.
 */
test("there's no smoke", async () => {
  // const { getByText, getByLabelText, findByText } = render(<App />);

  // expect(await findByText(/you can borrow kusd by opening a trove/i)).toBeInTheDocument();

  // fireEvent.click(getByText(/open trove/i));
  // fireEvent.click(getByLabelText(/collateral/i));
  // fireEvent.change(getByLabelText(/^collateral$/i), { target: { value: `${trove.collateral}` } });
  // fireEvent.click(getByLabelText(/^borrow$/i));
  // fireEvent.change(getByLabelText(/^borrow$/i), { target: { value: `${trove.debt}` } });

  // const confirmButton = await findByText(/confirm/i);
  // fireEvent.click(confirmButton);

  // expect(await findByText(/adjust/i)).toBeInTheDocument();
});
