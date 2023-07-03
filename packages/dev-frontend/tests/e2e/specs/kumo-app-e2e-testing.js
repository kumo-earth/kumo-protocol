describe('KUMO App e2e testing spec', () => {
  before(() => {
    cy.switchToMetamaskWindow();
    cy.importMetamaskAccount("0x60ddFE7f579aB6867cbE7A2Dc03853dC141d7A4aB6DBEFc0Dae2d2B1Bd4e487F");
    cy.importMetamaskToken({ address: '0x1D19b8b8b492bA72eA1Ff340D88FeF341C785A00', symbol: 'NBC' });
    cy.importMetamaskToken({ address: '0xB77Dc0B1D04E98E932c15D480a64E71691CF93B5', symbol: 'CSC' });
    cy.importMetamaskAccount("0xeaa445c85f7b438dEd6e831d06a4eD0CEBDc2f8527f84Fcda6EBB5fCfAd4C0e9");
    cy.importMetamaskToken({ address: '0x1D19b8b8b492bA72eA1Ff340D88FeF341C785A00', symbol: 'NBC' });
    cy.importMetamaskToken({ address: '0xB77Dc0B1D04E98E932c15D480a64E71691CF93B5', symbol: 'CSC' });
    cy.switchMetamaskAccount(2);
    cy.switchToCypressWindow();
  })

  it('should connect wallet with success and acceptMetamask with all Accounts', () => {
    cy.visit('/');
    cy.contains('CONNECT').click();
    cy.contains('MetaMask').click();
    cy.wait(5000)
    cy.switchToMetamaskWindow();
    cy.acceptMetamaskAccess({ allAccounts: true }).should("be.true");
    cy.switchToCypressWindow();
    cy.contains('DISCONNECT').should('be.visible');
  })

  it('should open the NBC vault with Account 2', () => {
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
  it('should adjust the NBC vault with Account 2', () => {
    cy.visit('/');
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
  it('should stake KUSD in NBC stability pool with Account 2', () => {
    cy.visit('/');
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

  it('should switch to Account 3 and open the Vault', () => {
    cy.switchToMetamaskWindow();
    cy.switchMetamaskAccount(3);
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
    cy.contains('ADJUST').should('be.visible');
  })

  it('should stake KUSD in NBC stability pool with Account 3', () => {
    cy.visit('/');
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

  it('should switch back to Account 2 and KUMO rewards should be greater than 0 (shows gain of rewards when Account 3 joins Stability Pool)', () => {
    cy.switchToMetamaskWindow();
    cy.switchMetamaskAccount(2);
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

});