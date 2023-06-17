describe('connect wallet spec', () => {
    it('should connect wallet with success', () => {
      cy.visit('/');
      cy.contains('CONNECT').click();
      cy.contains('MetaMask').click();
      cy.acceptMetamaskAccess().should("be.true");
      cy.switchMetamaskAccount(1);
      cy.switchToCypressWindow().should("be.true");
      cy.contains('DISCONNECT').should('be.visible');
    });
});