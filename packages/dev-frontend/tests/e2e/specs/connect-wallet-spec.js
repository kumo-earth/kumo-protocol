describe('connect wallet spec', () => {
    it('should connect wallet with success', () => {
      cy.visit('/');
      cy.wait(30000);
      cy.contains('CONNECT').click();
      cy.wait(5000);
      cy.contains('MetaMask').click();
      cy.wait(5000);
      cy.switchToMetamaskWindow();
      cy.acceptMetamaskAccess().should("be.true");
      cy.switchToCypressWindow();
      cy.contains('DISCONNECT').should('be.visible');
    });
});