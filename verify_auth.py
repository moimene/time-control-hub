from playwright.sync_api import sync_playwright

def verify_password_toggle():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()

        # Navigate to the Auth page (assuming default Vite port)
        try:
            page.goto("http://localhost:5173/auth")
            page.wait_for_load_state("networkidle")
        except Exception as e:
            print(f"Error navigating: {e}")
            return

        # Wait for the login tab to be visible
        try:
            page.wait_for_selector('button[role="tab"][value="login"]', timeout=10000)
        except Exception as e:
             print(f"Timeout waiting for selector: {e}")
             page.screenshot(path="verification_error.png")
             return

        # Find the password input in the login tab
        password_input = page.locator('#login-password')

        if not password_input.is_visible():
            print("Password input not visible")
            return

        # Type a password
        password_input.fill("secret123")

        # Check initial type is password
        type_attr = password_input.get_attribute("type")
        print(f"Initial type: {type_attr}")

        # Find the toggle button (it should be the button inside the relative div)
        # Using aria-label for robust selection
        toggle_btn = page.locator('button[aria-label="Show password"]')

        if not toggle_btn.is_visible():
            print("Toggle button not visible")
            return

        # Take a screenshot before toggling
        page.screenshot(path="before_toggle.png")

        # Click the toggle button
        toggle_btn.click()

        # Check type is now text
        type_attr_after = password_input.get_attribute("type")
        print(f"After toggle type: {type_attr_after}")

        # Take a screenshot after toggling
        page.screenshot(path="after_toggle.png")

        browser.close()

if __name__ == "__main__":
    verify_password_toggle()
