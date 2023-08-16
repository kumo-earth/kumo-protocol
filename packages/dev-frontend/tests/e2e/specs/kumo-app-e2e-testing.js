describe('KUMO App e2e testing spec', () => {
  const testUsers = {
    Alice: 3,
    Bob: 4,
    Carol: 5
  }
  before(() => {
    cy.switchToMetamaskWindow();
    cy.importMetamaskAccount("0x60ddFE7f579aB6867cbE7A2Dc03853dC141d7A4aB6DBEFc0Dae2d2B1Bd4e487F");
    cy.importMetamaskToken({ address: '0x1D19b8b8b492bA72eA1Ff340D88FeF341C785A00', symbol: 'NBC' });
    cy.importMetamaskToken({ address: '0xB77Dc0B1D04E98E932c15D480a64E71691CF93B5', symbol: 'CSC' });
    cy.importMetamaskAccount("0xeaa445c85f7b438dEd6e831d06a4eD0CEBDc2f8527f84Fcda6EBB5fCfAd4C0e9");
    cy.importMetamaskToken({ address: '0x1D19b8b8b492bA72eA1Ff340D88FeF341C785A00', symbol: 'NBC' });
    cy.importMetamaskToken({ address: '0xB77Dc0B1D04E98E932c15D480a64E71691CF93B5', symbol: 'CSC' });
    cy.importMetamaskAccount("0x8b693607Bd68C4dEB7bcF976a473Cf998BDE9fBeDF08e1D8ADadAcDff4e5D1b6");
    cy.importMetamaskToken({ address: '0x1D19b8b8b492bA72eA1Ff340D88FeF341C785A00', symbol: 'NBC' });
    cy.importMetamaskToken({ address: '0xB77Dc0B1D04E98E932c15D480a64E71691CF93B5', symbol: 'CSC' });
    cy.switchMetamaskAccount(testUsers.Alice);
    cy.switchToCypressWindow();
  })

  it('should connect wallet with success and acceptMetamask with all testUser accounts', () => {
    cy.visit('/');
    cy.contains('CONNECT').click();
    cy.contains('MetaMask').click();
    cy.wait(5000)
    cy.switchToMetamaskWindow();
    cy.acceptMetamaskAccess({ allAccounts: true }).should("be.true");
    cy.switchToCypressWindow();
    cy.contains('DISCONNECT').should('be.visible');
  })

  it('should check sidebar navigation', () => {
    cy.visit('/');
    cy.contains('CONNECT').click();
    cy.contains('MetaMask').click();
    cy.contains('DISCONNECT').should('be.visible');
    if (cy.get('#close-window')) {
      cy.get('#close-window').click();
    }
    cy.contains('a', 'Dashboard').click();
    cy.get('h1').should('have.text', 'Dashboard');
    cy.contains('a', 'Portfolio').click();
    cy.get('h1').should('have.text', 'Portfolio');
    cy.contains('a', 'Staking').click();
    cy.get('h1').should('have.text', 'Staking');
    cy.contains('a', 'Redemption').click();
    cy.get('h1').should('have.text', 'Redemption');
    cy.contains('a', 'Stats').click();
    cy.get('h1').first().should('have.text', 'Stats Protocol');
    cy.contains('a', 'Faucet').click();
    cy.get('h1').should('have.text', 'Faucet');
  })

  it('Alice should open the NBC vault', () => {
    cy.visit('/');
    cy.contains('CONNECT').click();
    cy.contains('MetaMask').click();
    cy.contains('DISCONNECT').should('be.visible');
    if (cy.get('#close-window')) {
      cy.get('#close-window').click();
    }
    cy.contains('NBC Vault').click();
    cy.contains('OPEN VAULT').click();
    cy.get('#trove-collateral').click();
    cy.get('#trove-collateral').clear();
    cy.get('#trove-collateral').type(16);
    cy.contains("CONFIRM").click();
    cy.wait(10000);
    cy.switchToMetamaskNotification();
    cy.confirmMetamaskTransaction();
    cy.switchToCypressWindow();
    cy.wait(10000);
    cy.get('#trove-collateral > div > span').should('have.text', '16NBC');
    cy.get('#trove-collateral-ratio > div > span').should('have.text', '159.3%');
    cy.contains('ADJUST').should('be.visible');
  })

  it('Alice should adjust the NBC vault', () => {
    cy.visit('/');
    cy.reload();
    cy.contains('CONNECT').click();
    cy.contains('MetaMask').click();
    cy.contains('DISCONNECT').should('be.visible');
    if (cy.get('#close-window')) {
      cy.get('#close-window').click();
    }
    cy.contains('NBC Vault').click();
    cy.contains('ADJUST').click();
    cy.get('#trove-collateral').click();
    cy.get('#trove-collateral').clear();
    cy.get('#trove-collateral').type(18);
    cy.contains("CONFIRM").click();
    cy.wait(10000);
    cy.switchToMetamaskNotification();
    cy.confirmMetamaskTransaction();
    cy.switchToCypressWindow();
    cy.wait(10000);
    cy.get('#trove-collateral > div > span').should('have.text', '18NBC')
    cy.get('#trove-collateral-ratio > div > span').should('have.text', '179.2%');
    cy.contains('ADJUST').should('be.visible');
  })

  it('Alice should stake KUSD in NBC Stability Pool', () => {
    cy.visit('/');
    cy.reload();
    cy.contains('CONNECT').click();
    cy.contains('MetaMask').click();
    cy.contains('DISCONNECT').should('be.visible');
    if (cy.get('#close-window')) {
      cy.get('#close-window').click();
    }
    cy.contains('Staking').click();
    cy.contains('Stability Pool Staking').click();
    cy.contains('NBC Stability Pool Staking').click();
    cy.contains('DEPOSIT').click();
    cy.get('#deposit-kumo').click();
    cy.get('#deposit-kumo').clear();
    cy.get('#deposit-kumo').type(500);
    cy.contains("CONFIRM").click();
    cy.wait(10000);
    cy.switchToMetamaskNotification();
    cy.confirmMetamaskTransaction();
    cy.switchToCypressWindow();
    cy.wait(10000);
    cy.get('#deposit-kusd > div > span').should('have.text', '500.00KUSD')
    cy.get('#deposit-reward > div > span').first().invoke('text').then(parseInt).should('equal', 0);
    cy.contains('ADJUST').should('be.visible');
  })

  it('Alice should adjust KUSD in NBC Stability Pool', () => {
    cy.visit('/');
    cy.reload();
    cy.contains('CONNECT').click();
    cy.contains('MetaMask').click();
    cy.contains('DISCONNECT').should('be.visible');
    if (cy.get('#close-window')) {
      cy.get('#close-window').click();
    }
    cy.contains('Staking').click();
    cy.contains('Stability Pool Staking').click();
    cy.contains('NBC Stability Pool Staking').click();
    cy.contains('ADJUST').click();
    cy.get('#deposit-kumo').click();
    cy.get('#deposit-kumo').clear();
    cy.get('#deposit-kumo').type(600);
    cy.contains("CONFIRM").click();
    cy.wait(10000);
    cy.switchToMetamaskNotification();
    cy.confirmMetamaskTransaction();
    cy.switchToCypressWindow();
    cy.wait(10000);
    cy.get('#deposit-kusd > div > span').should('have.text', '600.00KUSD')
    cy.get('#deposit-reward > div > span').first().invoke('text').then(parseInt).should('equal', 0);
    cy.contains('ADJUST').should('be.visible');
  })

  it('Alice should open the CSC vault', () => {
    cy.visit('/');
    cy.contains('CONNECT').click();
    cy.contains('MetaMask').click();
    cy.contains('DISCONNECT').should('be.visible');
    if (cy.get('#close-window')) {
      cy.get('#close-window').click();
    }
    cy.contains('CSC Vault').click();
    cy.contains('OPEN VAULT').click();
    cy.get('#trove-collateral').click();
    cy.get('#trove-collateral').clear();
    cy.get('#trove-collateral').type(16);
    cy.contains("CONFIRM").click();
    cy.wait(10000);
    cy.switchToMetamaskNotification();
    cy.confirmMetamaskTransaction();
    cy.switchToCypressWindow();
    cy.wait(10000);
    cy.get('#trove-collateral > div > span').should('have.text', '16CSC');
    cy.get('#trove-collateral-ratio > div > span').should('have.text', '159.3%');
    cy.contains('ADJUST').should('be.visible');
  })

  it('Alice should adjust the CSC vault', () => {
    cy.visit('/');
    cy.reload();
    cy.contains('CONNECT').click();
    cy.contains('MetaMask').click();
    cy.contains('DISCONNECT').should('be.visible');
    if (cy.get('#close-window')) {
      cy.get('#close-window').click();
    }
    cy.contains('CSC Vault').click();
    cy.contains('ADJUST').click();
    cy.get('#trove-collateral').click();
    cy.get('#trove-collateral').clear();
    cy.get('#trove-collateral').type(18);
    cy.contains("CONFIRM").click();
    cy.wait(10000);
    cy.switchToMetamaskNotification();
    cy.confirmMetamaskTransaction();
    cy.switchToCypressWindow();
    cy.wait(10000);
    cy.get('#trove-collateral > div > span').should('have.text', '18CSC')
    cy.get('#trove-collateral-ratio > div > span').should('have.text', '179.2%');
    cy.contains('ADJUST').should('be.visible');
  })

  it('Alice should stake KUSD in CSC stability pool', () => {
    cy.visit('/');
    cy.reload();
    cy.contains('CONNECT').click();
    cy.contains('MetaMask').click();
    cy.contains('DISCONNECT').should('be.visible');
    if (cy.get('#close-window')) {
      cy.get('#close-window').click();
    }
    cy.contains('Staking').click();
    cy.contains('Stability Pool Staking').click();
    cy.contains('CSC Stability Pool Staking').click();
    cy.contains('DEPOSIT').click();
    cy.get('#deposit-kumo').click();
    cy.get('#deposit-kumo').clear();
    cy.get('#deposit-kumo').type(500);
    cy.contains("CONFIRM").click();
    cy.wait(10000);
    cy.switchToMetamaskNotification();
    cy.confirmMetamaskTransaction();
    cy.switchToCypressWindow();
    cy.wait(10000);
    cy.get('#deposit-kusd > div > span').should('have.text', '500.00KUSD')
    cy.get('#deposit-reward > div > span').first().invoke('text').then(parseInt).should('equal', 0);
    cy.contains('ADJUST').should('be.visible');
  })

  it('Alice should adjust KUSD in CSC Stability Pool', () => {
    cy.visit('/');
    cy.reload();
    cy.contains('CONNECT').click();
    cy.contains('MetaMask').click();
    cy.contains('DISCONNECT').should('be.visible');
    if (cy.get('#close-window')) {
      cy.get('#close-window').click();
    }
    cy.contains('Staking').click();
    cy.contains('Stability Pool Staking').click();
    cy.contains('CSC Stability Pool Staking').click();
    cy.contains('ADJUST').click();
    cy.get('#deposit-kumo').click();
    cy.get('#deposit-kumo').clear();
    cy.get('#deposit-kumo').type(600);
    cy.contains("CONFIRM").click();
    cy.wait(10000);
    cy.switchToMetamaskNotification();
    cy.confirmMetamaskTransaction();
    cy.switchToCypressWindow();
    cy.wait(10000);
    cy.get('#deposit-kusd > div > span').should('have.text', '600.00KUSD')
    cy.get('#deposit-reward > div > span').first().invoke('text').then(parseInt).should('equal', 0);
    cy.contains('ADJUST').should('be.visible');
  })

  it('should check correct values for TCR, MINTED KUSD and Carbon Credits', () => {
    cy.visit('/');
    cy.contains('CONNECT').click();
    cy.contains('MetaMask').click();
    cy.contains('DISCONNECT').should('be.visible');
    if (cy.get('#close-window')) {
      cy.get('#close-window').click();
    }
    cy.contains('p', 'TOTAL COLLATERAL').next().should('have.text', '$7,200');
    cy.contains('p', 'TOTAL MINTED KUSD').next().should('have.text', '$4,018');
    cy.contains('p', 'TOTAL CARBON CREDITS').next().should('have.text', '36');
  })

  it('should switch to Bob account and open the Vault', () => {
    cy.switchToMetamaskWindow();
    cy.switchMetamaskAccount(testUsers.Bob);
    cy.resetMetamaskAccount();
    cy.switchToCypressWindow();
    cy.visit('/');
    cy.contains('CONNECT').click();
    cy.contains('MetaMask').click();
    cy.contains('DISCONNECT').should('be.visible');
    if (cy.get('#close-window')) {
      cy.get('#close-window').click();
    }
    cy.contains('NBC Vault').click();
    cy.contains('OPEN VAULT').click();
    cy.get('#trove-collateral').click();
    cy.get('#trove-collateral').clear();
    cy.get('#trove-collateral').type(18);
    cy.contains("CONFIRM").click();
    cy.wait(10000);
    cy.switchToMetamaskNotification();
    cy.confirmMetamaskTransaction();
    cy.switchToCypressWindow();
    cy.wait(10000);
    cy.get('#trove-collateral > div > span').should('have.text', '18NBC');
    cy.get('#trove-collateral-ratio > div > span').should('have.text', '179.2%');
    cy.contains('ADJUST').should('be.visible');
  })

  it('Bob should stake KUSD in NBC stability pool', () => {
    cy.visit('/');
    cy.reload();
    cy.contains('CONNECT').click();
    cy.contains('MetaMask').click();
    cy.contains('DISCONNECT').should('be.visible');
    if (cy.get('#close-window')) {
      cy.get('#close-window').click();
    }
    cy.contains('Staking').click();
    cy.contains('Stability Pool Staking').click();
    cy.contains('NBC Stability Pool Staking').click();
    cy.contains('DEPOSIT').click();
    cy.get('#deposit-kumo').click();
    cy.get('#deposit-kumo').clear();
    cy.get('#deposit-kumo').type(500);
    cy.contains("CONFIRM").click();
    cy.wait(10000);
    cy.switchToMetamaskNotification();
    cy.confirmMetamaskTransaction();
    cy.switchToCypressWindow();
    cy.wait(10000);
    cy.get('#deposit-kusd > div > span').should('have.text', '500.00KUSD');
    cy.contains('ADJUST').should('be.visible');
  });

  it.skip('should switch to Alice and KUMO rewards should be greater than 0 (get rewarded when Bob joined Stability Pool)', () => {
    cy.switchToMetamaskWindow();
    cy.switchMetamaskAccount(testUsers.Alice);
    cy.resetMetamaskAccount();
    cy.switchToCypressWindow();
    cy.visit('/');
    cy.reload();
    cy.contains('CONNECT').click();
    cy.contains('MetaMask').click();
    cy.contains('DISCONNECT').should('be.visible');
    if (cy.get('#close-window')) {
      cy.get('#close-window').click();
    }
    cy.contains('Staking').click();
    cy.contains('Stability Pool Staking').click();
    cy.contains('NBC Stability Pool Staking').click();
    cy.contains('ADJUST').should('be.visible');
    cy.get('#deposit-reward > div > span').first().invoke('text').then(parseInt).should('be.greaterThan', 0)
  })

  it('should switch to Carol account and open the Vault', () => {
    cy.switchToMetamaskWindow();
    cy.switchMetamaskAccount(testUsers.Carol);
    cy.resetMetamaskAccount();
    cy.switchToCypressWindow();
    cy.visit('/');
    cy.contains('CONNECT').click();
    cy.contains('MetaMask').click();
    cy.contains('DISCONNECT').should('be.visible');
    if (cy.get('#close-window')) {
      cy.get('#close-window').click();
    }
    cy.contains('NBC Vault').click();
    cy.contains('OPEN VAULT').click();
    cy.get('#trove-collateral').click();
    cy.get('#trove-collateral').clear();
    cy.get('#trove-collateral').type(16);
    cy.contains("CONFIRM").click();
    cy.wait(10000);
    cy.switchToMetamaskNotification();
    cy.confirmMetamaskTransaction();
    cy.switchToCypressWindow();
    cy.wait(10000);
    cy.get('#trove-collateral > div > span').should('have.text', '16NBC');
    cy.get('#trove-collateral-ratio > div > span').should('have.text', '159.3%');
    cy.contains('ADJUST').scrollIntoView().should('be.visible');
  })

  it('should liquidate the Vault created by Bob and should transfer NBC tokens to Stability Pool depositers as a liquidation gain', () => {
    cy.visit('/');
    cy.reload();
    cy.contains('CONNECT').click();
    cy.contains('MetaMask').click();
    cy.contains('DISCONNECT').should('be.visible');
    if (cy.get('#close-window')) {
      cy.get('#close-window').click();
    }
    cy.contains('Stats').click();
    cy.contains('RISKY Vaults').click();
    cy.get('input[name="price-manager"]').click();
    cy.get('input[name="price-manager"]').clear();
    cy.get('input[name="price-manager"]').type(137);
    cy.get('#set-price-btn').click();
    cy.wait(10000);
    cy.switchToMetamaskNotification();
    cy.confirmMetamaskTransaction();
    cy.switchToCypressWindow();
    cy.wait(10000);
    cy.get('#reload-btn').click();
    cy.get('input[name="price-manager"]').invoke('val').then(price => {
      const currentPrice = price;
      expect(currentPrice).to.equal('137.00');
    })
    cy.get('#risky-vaults-table tbody tr').should('have.length', 3)
    cy.contains('td', '109.1%').siblings().get('#liq-btn').click();
    cy.wait(10000);
    cy.switchToMetamaskNotification();
    cy.confirmMetamaskTransaction();
    cy.switchToCypressWindow();
    cy.wait(10000);
    cy.get('#reload-btn').click();
    cy.get('#risky-vaults-table tbody tr').should('have.length', 2);
    cy.get('input[name="price-manager"]').click();
    cy.get('input[name="price-manager"]').clear();
    cy.get('input[name="price-manager"]').type(200);
    cy.get('#set-price-btn').click();
    cy.wait(10000);
    cy.switchToMetamaskNotification();
    cy.confirmMetamaskTransaction();
    cy.switchToCypressWindow();
    cy.wait(10000);
    cy.get('#reload-btn').click();
    cy.get('input[name="price-manager"]').invoke('val').then(price => {
      const currentPrice = price;
      expect(currentPrice).to.equal('200.00');
    })
    cy.switchToMetamaskWindow();
    cy.switchMetamaskAccount(testUsers.Alice);
    cy.resetMetamaskAccount();
    cy.switchToCypressWindow();
    cy.reload();
    cy.contains('Staking').click();
    cy.contains('Stability Pool Staking').click();
    cy.contains('NBC Stability Pool Staking').click();
    cy.contains('ADJUST').should('be.visible');
    cy.get('#deposit-gain > div > span').first().invoke('text').then(parseInt).should('be.greaterThan', 0);
    cy.switchToMetamaskWindow();
    cy.switchMetamaskAccount(testUsers.Bob);
    cy.resetMetamaskAccount();
    cy.switchToCypressWindow();
    cy.reload();
    cy.contains('Staking').click();
    cy.contains('Stability Pool Staking').click();
    cy.contains('NBC Stability Pool Staking').click();
    cy.contains('ADJUST').should('be.visible');
    cy.get('#deposit-gain > div > span').first().invoke('text').then(parseInt).should('be.greaterThan', 0)
  })

});