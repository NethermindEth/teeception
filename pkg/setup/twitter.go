package setup

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"time"

	"github.com/NethermindEth/teeception/pkg/auth"
	"github.com/sethvargo/go-password/password"
	"github.com/tebeka/selenium"
)

const (
	twitterLoginUrl    = "https://twitter.com/i/flow/login"
	twitterPasswordUrl = "https://x.com/settings/password"

	twitterSubmitButtonXpath   = `/html/body/div[1]/div/div/div[2]/main/div/div/div/section[2]/div[2]/div[3]/button`
	twitterUsernameSelector    = `input[autocomplete="username"]`
	twitterPasswordSelector    = `input[name="password"]`
	twitterCurrentPasswordName = "current_password"
	twitterNewPasswordName     = "new_password"
	twitterConfirmPasswordName = "password_confirmation"

	twitterSelectionTimeout = 20 * time.Second
	twitterLoginDelay       = 15 * time.Second
	twitterNavigationDelay  = 30 * time.Second
	twitterInputDelay       = 2 * time.Second
)

func (m *SetupManager) ChangeTwitterPassword() (string, error) {
	currentPassword := m.twitterPassword
	if currentPassword == "" {
		return "", fmt.Errorf("X_PASSWORD not found in environment")
	}

	driver, err := NewSeleniumDriver()
	if err != nil {
		return "", fmt.Errorf("failed to create selenium driver: %v", err)
	}
	defer driver.Close()

	if err := driver.Get(twitterLoginUrl); err != nil {
		return "", fmt.Errorf("failed to navigate to login page: %v", err)
	}

	time.Sleep(twitterNavigationDelay)

	err = driver.WaitWithTimeout(func(wd selenium.WebDriver) (bool, error) {
		username, err := wd.FindElement(selenium.ByCSSSelector, twitterUsernameSelector)
		if err != nil {
			return false, nil
		}
		if err := username.SendKeys(m.twitterAccount + selenium.EnterKey); err != nil {
			return false, err
		}
		return true, nil
	}, twitterSelectionTimeout)
	if err != nil {
		return "", fmt.Errorf("failed to find or interact with username field: %v", err)
	}
	slog.Info("username entered")

	err = driver.WaitWithTimeout(func(wd selenium.WebDriver) (bool, error) {
		password, err := wd.FindElement(selenium.ByCSSSelector, twitterPasswordSelector)
		if err != nil {
			return false, nil
		}
		if err := password.SendKeys(currentPassword + selenium.EnterKey); err != nil {
			return false, err
		}
		return true, nil
	}, twitterSelectionTimeout)
	if err != nil {
		return "", fmt.Errorf("failed to find or interact with password field: %v", err)
	}
	slog.Info("password entered")

	time.Sleep(twitterLoginDelay)

	newPasswordStr, err := password.Generate(16, 4, 4, false, false)
	if err != nil {
		return "", fmt.Errorf("failed to generate new password: %v", err)
	}
	slog.Info("new password generated", "password", newPasswordStr)

	if err := driver.Get(twitterPasswordUrl); err != nil {
		return "", fmt.Errorf("failed to navigate to password settings: %v", err)
	}

	time.Sleep(twitterInputDelay)

	err = driver.WaitWithTimeout(func(wd selenium.WebDriver) (bool, error) {
		currentPwdField, err := wd.FindElement(selenium.ByName, twitterCurrentPasswordName)
		if err != nil {
			return false, nil
		}
		if err := currentPwdField.SendKeys(currentPassword); err != nil {
			return false, err
		}
		return true, nil
	}, twitterSelectionTimeout)
	if err != nil {
		return "", fmt.Errorf("failed to find or interact with current password field: %v", err)
	}
	slog.Info("current password entered")

	err = driver.WaitWithTimeout(func(wd selenium.WebDriver) (bool, error) {
		newPwdField, err := wd.FindElement(selenium.ByName, twitterNewPasswordName)
		if err != nil {
			return false, nil
		}
		if err := newPwdField.SendKeys(newPasswordStr); err != nil {
			return false, err
		}
		return true, nil
	}, twitterSelectionTimeout)
	if err != nil {
		return "", fmt.Errorf("failed to find or interact with new password field: %v", err)
	}
	slog.Info("new password entered")

	err = driver.WaitWithTimeout(func(wd selenium.WebDriver) (bool, error) {
		confirmPwdField, err := wd.FindElement(selenium.ByName, twitterConfirmPasswordName)
		if err != nil {
			return false, nil
		}
		if err := confirmPwdField.SendKeys(newPasswordStr); err != nil {
			return false, err
		}
		return true, nil
	}, twitterSelectionTimeout)
	if err != nil {
		return "", fmt.Errorf("failed to find or interact with confirm password field: %v", err)
	}
	slog.Info("password confirmation entered")

	err = driver.WaitWithTimeout(func(wd selenium.WebDriver) (bool, error) {
		submitButton, err := wd.FindElement(selenium.ByXPATH, twitterSubmitButtonXpath)
		if err != nil {
			return false, nil
		}
		if err := submitButton.Click(); err != nil {
			return false, err
		}
		return true, nil
	}, twitterSelectionTimeout)
	if err != nil {
		return "", fmt.Errorf("failed to find or click submit button: %v", err)
	}

	return newPasswordStr, nil
}

type TwitterAuthTokens struct {
	CT0       string `json:"ct0"`
	AuthToken string `json:"auth_token"`
}

func (m *SetupManager) GetTwitterTokens(ctx context.Context) (string, *auth.OAuthTokenPair, error) {
	driver, err := NewSeleniumDriver()
	if err != nil {
		return "", nil, fmt.Errorf("failed to create selenium driver: %v", err)
	}
	defer driver.Close()

	if err := driver.Get(twitterLoginUrl); err != nil {
		return "", nil, fmt.Errorf("failed to navigate to login page: %v", err)
	}

	time.Sleep(twitterNavigationDelay)

	err = driver.WaitWithTimeout(func(wd selenium.WebDriver) (bool, error) {
		username, err := wd.FindElement(selenium.ByCSSSelector, twitterUsernameSelector)
		if err != nil {
			return false, nil
		}
		if err := username.SendKeys(m.twitterAccount + selenium.EnterKey); err != nil {
			return false, err
		}
		return true, nil
	}, twitterSelectionTimeout)
	if err != nil {
		return "", nil, fmt.Errorf("failed to find or interact with username field: %v", err)
	}
	slog.Info("username entered")

	time.Sleep(twitterInputDelay)

	var inputField selenium.WebElement
	err = driver.WaitWithTimeout(func(wd selenium.WebDriver) (bool, error) {
		pwdField, err := wd.FindElement(selenium.ByCSSSelector, twitterPasswordSelector)
		if err == nil {
			inputField = pwdField
			return true, nil
		}

		emailField, err := wd.FindElement(selenium.ByCSSSelector, `input[autocomplete="on"]`)
		if err == nil {
			inputField = emailField
			return true, nil
		}

		return false, nil
	}, twitterSelectionTimeout)
	if err != nil {
		return "", nil, fmt.Errorf("failed to find input field: %v", err)
	}

	autocomplete, err := inputField.GetAttribute("autocomplete")
	if err != nil {
		return "", nil, fmt.Errorf("failed to get input field attribute: %v", err)
	}

	if autocomplete == "on" {
		slog.Info("Found email field")
		if err := inputField.SendKeys(m.protonEmail + selenium.EnterKey); err != nil {
			return "", nil, fmt.Errorf("failed to enter email: %v", err)
		}
		time.Sleep(twitterInputDelay)

		err = driver.WaitWithTimeout(func(wd selenium.WebDriver) (bool, error) {
			var err error
			inputField, err = wd.FindElement(selenium.ByCSSSelector, `input[autocomplete="current-password"]`)
			return err == nil, nil
		}, twitterSelectionTimeout)
		if err != nil {
			return "", nil, fmt.Errorf("failed to find password field after email verification: %v", err)
		}
	}

	slog.Info("entering password")
	if err := inputField.SendKeys(m.twitterPassword + selenium.EnterKey); err != nil {
		return "", nil, fmt.Errorf("failed to enter password: %v", err)
	}

	time.Sleep(twitterLoginDelay)

	ct0Cookie, err := driver.GetCookie("ct0")
	if err != nil {
		return "", nil, fmt.Errorf("failed to get ct0 cookie: %v", err)
	}

	authTokenCookie, err := driver.GetCookie("auth_token")
	if err != nil {
		return "", nil, fmt.Errorf("failed to get auth_token cookie: %v", err)
	}

	authTokens, err := json.Marshal(TwitterAuthTokens{
		CT0:       ct0Cookie.Value,
		AuthToken: authTokenCookie.Value,
	})
	if err != nil {
		return "", nil, fmt.Errorf("failed to marshal tokens: %v", err)
	}

	twitterLoginServer := auth.NewTwitterLoginServer(m.loginServerUrl, m.twitterAppKey, m.twitterAppSecret)
	twitterLoginServer.Start()

	slog.Info("navigating to login")
	if err := driver.Get(twitterLoginServer.GetLoginRoute()); err != nil {
		return "", nil, fmt.Errorf("failed to navigate to login endpoint: %v", err)
	}

	time.Sleep(twitterNavigationDelay)

	err = driver.WaitWithTimeout(func(wd selenium.WebDriver) (bool, error) {
		allowButton, err := wd.FindElement(selenium.ByCSSSelector, `input[id="allow"]`)
		if err != nil {
			return false, nil
		}
		return true, allowButton.Click()
	}, twitterSelectionTimeout)
	if err != nil {
		slog.Warn("failed to find or click allow button", "error", err)
	}

	tokenPair, err := twitterLoginServer.WaitForTokenPair(ctx)
	if err != nil {
		return "", nil, fmt.Errorf("failed to get token pair: %v", err)
	}

	return string(authTokens), tokenPair, nil
}
