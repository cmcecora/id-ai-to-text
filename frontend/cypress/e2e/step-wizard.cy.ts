describe('Medical Booking Step Wizard', () => {
  beforeEach(() => {
    // Mock the auth session check to return authenticated user
    cy.intercept('GET', '**/api/auth/get-session', {
      statusCode: 200,
      body: {
        user: {
          id: 'test-user-id',
          email: 'test@example.com',
          name: 'Test User',
          emailVerified: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        session: {
          token: 'test-session-token',
          userId: 'test-user-id',
          expiresAt: new Date(Date.now() + 86400000).toISOString()
        }
      }
    }).as('getSession');

    cy.visit('/book-test');
    cy.wait('@getSession');
  });

  describe('Step Navigation', () => {
    it('should start on Step 1', () => {
      cy.get('.step-item').first().should('have.class', 'active');
      cy.get('.step-content h2').should('contain', 'Select Your Test');
    });

    it('should navigate from Step 1 to Step 2 with single click', () => {
      // Select a test first to enable Continue button
      cy.get('.test-search-wrapper input').click();
      cy.get('.autocomplete-dropdown').should('be.visible');
      cy.get('.test-item').first().click();

      // Click Continue once
      cy.get('.action-buttons .btn-primary').should('not.be.disabled');
      cy.get('.action-buttons .btn-primary').click();

      // Should be on Step 2
      cy.waitForAnimation();
      cy.get('.step-item').eq(1).should('have.class', 'active');
      cy.get('.step-content h2').should('contain', 'Choose Date & Time');
    });

    it('should not skip steps when clicking Continue rapidly', () => {
      // Select a test
      cy.get('.test-search-wrapper input').click();
      cy.get('.test-item').first().click();

      // Rapid click Continue button (simulating double-click)
      cy.get('.action-buttons .btn-primary').click();
      cy.get('.action-buttons .btn-primary').click({ force: true });
      cy.get('.action-buttons .btn-primary').click({ force: true });

      // Wait for animation
      cy.waitForAnimation();

      // Should be on Step 2, NOT Step 3 or beyond
      cy.get('.step-item').eq(1).should('have.class', 'active');
      cy.get('.step-content h2').should('contain', 'Choose Date & Time');
    });

    it('should disable Continue button during animation', () => {
      // Select a test
      cy.get('.test-search-wrapper input').click();
      cy.get('.test-item').first().click();

      // Click Continue
      cy.get('.action-buttons .btn-primary').click();

      // Button should be disabled during animation
      cy.get('.action-buttons .btn-primary').should('be.disabled');
    });

    it('should navigate back from Step 2 to Step 1', () => {
      // Go to Step 2
      cy.get('.test-search-wrapper input').click();
      cy.get('.test-item').first().click();
      cy.get('.action-buttons .btn-primary').click();
      cy.waitForAnimation();

      // Click Back
      cy.get('.action-buttons .btn-outline').click();
      cy.waitForAnimation();

      // Should be back on Step 1
      cy.get('.step-item').first().should('have.class', 'active');
      cy.get('.step-content h2').should('contain', 'Select Your Test');
    });
  });

  describe('Step 2 - Calendar and Time Slots', () => {
    beforeEach(() => {
      // Navigate to Step 2
      cy.get('.test-search-wrapper input').click();
      cy.get('.test-item').first().click();
      cy.get('.action-buttons .btn-primary').click();
      cy.waitForAnimation();
    });

    it('should display calendar without flashing', () => {
      // Calendar should be visible and stable
      cy.get('.calendar-container').should('be.visible');
      cy.get('.calendar-days').should('be.visible');
      cy.get('.calendar-day').should('have.length.at.least', 28);
    });

    it('should display time slots without flashing', () => {
      // Time slots should be visible and stable
      cy.get('.time-section').should('be.visible');
      cy.get('.time-slot').should('have.length.at.least', 1);
    });

    it('should select date and time without issues', () => {
      // Select an available date
      cy.get('.calendar-day:not(.unavailable):not(.empty)').first().click();
      cy.get('.calendar-day.selected').should('exist');

      // Select a time slot
      cy.get('.time-slot:not(.unavailable)').first().click();
      cy.get('.time-slot.selected').should('exist');
    });

    it('should proceed to Step 3 with single click after selecting date/time', () => {
      // Select date and time
      cy.get('.calendar-day:not(.unavailable):not(.empty)').first().click();
      cy.get('.time-slot:not(.unavailable)').first().click();

      // Click Continue once
      cy.get('.action-buttons .btn-primary').click();
      cy.waitForAnimation();

      // Should be on Step 3
      cy.get('.step-item').eq(2).should('have.class', 'active');
      cy.get('.step-content h2').should('contain', 'Upload Your Documents');
    });

    it('should not scroll unexpectedly when clicking Continue', () => {
      // Select date and time
      cy.get('.calendar-day:not(.unavailable):not(.empty)').first().click();
      cy.get('.time-slot:not(.unavailable)').first().click();

      // Get initial scroll position
      cy.window().then((win) => {
        const initialScrollY = win.scrollY;

        // Click Continue
        cy.get('.action-buttons .btn-primary').click();

        // Scroll position should be at top after navigation
        cy.waitForAnimation();
        cy.window().its('scrollY').should('be.lessThan', 100);
      });
    });
  });

  describe('Step 3 - ID Upload', () => {
    beforeEach(() => {
      // Navigate to Step 3
      cy.get('.test-search-wrapper input').click();
      cy.get('.test-item').first().click();
      cy.get('.action-buttons .btn-primary').click();
      cy.waitForAnimation();

      cy.get('.calendar-day:not(.unavailable):not(.empty)').first().click();
      cy.get('.time-slot:not(.unavailable)').first().click();
      cy.get('.action-buttons .btn-primary').click();
      cy.waitForAnimation();
    });

    it('should allow skipping ID upload', () => {
      // Click skip button
      cy.contains('Skip and enter information manually').click();
      cy.waitForAnimation();

      // Should be on Step 4
      cy.get('.step-item').eq(3).should('have.class', 'active');
      cy.get('.step-content h2').should('contain', 'Your Details');
    });

    it('should not skip to Step 5 when double-clicking skip', () => {
      // Rapid click skip button
      cy.contains('Skip and enter information manually').click();
      cy.contains('Skip and enter information manually').click({ force: true });
      cy.waitForAnimation();

      // Should be on Step 4, NOT Step 5
      cy.get('.step-item').eq(3).should('have.class', 'active');
      cy.get('.step-content h2').should('contain', 'Your Details');
    });
  });

  describe('Progress Steps - Click Navigation', () => {
    beforeEach(() => {
      // Navigate to Step 3
      cy.get('.test-search-wrapper input').click();
      cy.get('.test-item').first().click();
      cy.get('.action-buttons .btn-primary').click();
      cy.waitForAnimation();

      cy.get('.calendar-day:not(.unavailable):not(.empty)').first().click();
      cy.get('.time-slot:not(.unavailable)').first().click();
      cy.get('.action-buttons .btn-primary').click();
      cy.waitForAnimation();
    });

    it('should navigate back to Step 1 when clicking on Step 1 indicator', () => {
      cy.get('.step-item').eq(0).click();
      cy.waitForAnimation();

      cy.get('.step-content h2').should('contain', 'Select Your Test');
    });

    it('should navigate back to Step 2 when clicking on Step 2 indicator', () => {
      cy.get('.step-item').eq(1).click();
      cy.waitForAnimation();

      cy.get('.step-content h2').should('contain', 'Choose Date & Time');
    });

    it('should not skip steps when rapidly clicking progress indicators', () => {
      // Rapidly click Step 1
      cy.get('.step-item').eq(0).click();
      cy.get('.step-item').eq(0).click({ force: true });
      cy.waitForAnimation();

      // Should be on Step 1
      cy.get('.step-content h2').should('contain', 'Select Your Test');
    });
  });
});

