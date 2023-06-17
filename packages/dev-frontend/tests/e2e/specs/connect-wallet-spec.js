describe('connect wallet spec', () => {
    it('should connect wallet with success', () => {
      cy.visit('/');
      cy.contains('CONNECT').click();
      cy.contains('MetaMask').click();
      cy.wait(3000)
      cy.switchToMetamaskWindow();
      cy.acceptMetamaskAccess().should("be.true");
      cy.switchToCypressWindow();
      cy.wait(100000)
      cy.contains('DISCONNECT').should('be.visible');
    });
});