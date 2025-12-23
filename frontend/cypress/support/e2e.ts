// ***********************************************************
// This file is processed and loaded automatically before your test files.
// Put global configuration and behavior that modifies Cypress here.
// ***********************************************************

// Custom command to wait for animations to complete
Cypress.Commands.add('waitForAnimation', () => {
  cy.wait(500); // Wait for Angular animations to complete
});

// Custom command to check step number
Cypress.Commands.add('shouldBeOnStep', (stepNumber: number) => {
  cy.get('.step-item').eq(stepNumber - 1).should('have.class', 'active');
  cy.get(`.step-content`).should('be.visible');
});

// Extend Cypress types
declare global {
  namespace Cypress {
    interface Chainable {
      waitForAnimation(): Chainable<void>;
      shouldBeOnStep(stepNumber: number): Chainable<void>;
    }
  }
}

export {};

