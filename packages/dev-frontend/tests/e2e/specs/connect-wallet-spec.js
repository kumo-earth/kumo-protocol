describe('connect wallet spec', () => {
    it('should connect wallet with success', () => {
      cy.visit('/');
      cy.contains('CONNECT', {timeout: 5000 }).click();
      cy.contains('MetaMask', {timeout: 5000 }).click();
      cy.switchToMetamaskWindow();
      cy.acceptMetamaskAccess().should("be.true");
      cy.switchToCypressWindow();
      cy.contains('DISCONNECT').should('be.visible');
    });
});