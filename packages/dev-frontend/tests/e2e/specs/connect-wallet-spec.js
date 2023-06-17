describe('connect wallet spec', () => {
    it('should connect wallet with success', () => {
      cy.visit('/');
      cy.contains('CONNECT').click();
      cy.contains('MetaMask').click();
      cy.acceptMetamaskAccess();
      cy.wait(500000)
      cy.contains('DISCONNECT').should('be.visible');
    });
});