package twitter

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"strings"
	"time"

	"github.com/NethermindEth/teeception/pkg/utils/password"
	"github.com/NethermindEth/teeception/pkg/utils/selenium_utils"
	"github.com/tebeka/selenium"
)

const (
	twitterLoginUrl    = "https://x.com/i/flow/login"
	twitterPasswordUrl = "https://x.com/settings/password"

	twitterSubmitButtonXpath             = `/html/body/div[1]/div/div/div[2]/main/div/div/div/section[2]/div[2]/div[3]/button`
	twitterUsernameSelector              = `input[autocomplete="username"]`
	twitterEmailSelector                 = `input[autocomplete="email"]`
	twitterPasswordSelector              = `input[name="password"]`
	twitterVerificationCodeSelector      = `input[name="verification_code"]`
	twitterCurrentPasswordName           = "current_password"
	twitterNewPasswordName               = "new_password"
	twitterConfirmPasswordName           = "password_confirmation"
	twitterConfirmationCodeSpanSelector  = `//span[text()='Confirmation code']`
	twitterConfirmationCodeInputSelector = `input[name="text"]`

	twitterSelectionTimeout = 20 * time.Second
	twitterLoginDelay       = 15 * time.Second
	twitterNavigationDelay  = 30 * time.Second
	twitterInputDelay       = 2 * time.Second

	seleniumPort = 4444
)

type TwitterEncumberer struct {
	credentials         TwitterEncumbererCredentials
	loginServerIp       string
	loginServerPort     string
	getVerificationCode func(ctx context.Context) (string, error)
	debug               bool
}

type TwitterEncumbererOutput struct {
	NewPassword    string
	AuthTokens     string
	OAuthTokenPair *OAuthTokenPair
}

type TwitterAuthTokens struct {
	CT0       string `json:"ct0"`
	AuthToken string `json:"auth_token"`
}

type TwitterEncumbererCredentials struct {
	TwitterUsername  string
	TwitterPassword  string
	TwitterEmail     string
	TwitterAppKey    string
	TwitterAppSecret string
}

func NewTwitterEncumberer(credentials TwitterEncumbererCredentials, loginServerIp, loginServerPort string, getVerificationCode func(ctx context.Context) (string, error), debug bool) *TwitterEncumberer {
	return &TwitterEncumberer{
		credentials:         credentials,
		loginServerIp:       loginServerIp,
		loginServerPort:     loginServerPort,
		getVerificationCode: getVerificationCode,
		debug:               debug,
	}
}

func (t *TwitterEncumberer) Login(ctx context.Context, driver *selenium_utils.SeleniumDriver) error {
	slog.Info("attempting to login to twitter", "url", twitterLoginUrl)
	if err := driver.Get(twitterLoginUrl); err != nil {
		return fmt.Errorf("failed to navigate to login page: %v", err)
	}

	slog.Info("waiting for page to load", "delay", twitterNavigationDelay)
	time.Sleep(twitterNavigationDelay)

	err := driver.WaitWithTimeout(func(wd selenium.WebDriver) (bool, error) {
		username, err := wd.FindElement(selenium.ByCSSSelector, twitterUsernameSelector)
		if err != nil {
			return false, nil
		}
		if err := username.SendKeys(t.credentials.TwitterUsername + selenium.EnterKey); err != nil {
			return false, err
		}
		return true, nil
	}, twitterSelectionTimeout)
	if err != nil {
		return fmt.Errorf("failed to find or interact with username field: %v", err)
	}
	slog.Info("username entered", "username", t.credentials.TwitterUsername)

	err = driver.WaitWithTimeout(func(wd selenium.WebDriver) (bool, error) {
		email, err := wd.FindElement(selenium.ByCSSSelector, twitterEmailSelector)
		if err != nil {
			return false, nil
		}
		if err := email.SendKeys(t.credentials.TwitterEmail + selenium.EnterKey); err != nil {
			return false, err
		}
		return true, nil
	}, twitterSelectionTimeout)
	if err != nil {
		// This is not a critical error, so we just log it and continue
		slog.Warn("failed to find possible email field", "error", err)
	} else {
		slog.Info("email entered", "email", t.credentials.TwitterEmail)
	}

	err = driver.WaitWithTimeout(func(wd selenium.WebDriver) (bool, error) {
		password, err := wd.FindElement(selenium.ByCSSSelector, twitterPasswordSelector)
		if err != nil {
			return false, nil
		}
		if err := password.SendKeys(t.credentials.TwitterPassword + selenium.EnterKey); err != nil {
			return false, err
		}
		return true, nil
	}, twitterSelectionTimeout)
	if err != nil {
		return fmt.Errorf("failed to find or interact with password field: %v", err)
	}
	slog.Info("password entered", "password", t.credentials.TwitterPassword)

	err = driver.WaitWithTimeout(func(wd selenium.WebDriver) (bool, error) {
		email, err := wd.FindElement(selenium.ByCSSSelector, twitterEmailSelector)
		if err != nil {
			return false, nil
		}
		if err := email.SendKeys(t.credentials.TwitterEmail + selenium.EnterKey); err != nil {
			return false, err
		}
		return true, nil
	}, twitterSelectionTimeout)
	if err != nil {
		// This is not a critical error, so we just log it and continue
		slog.Warn("failed to find possible email field", "error", err)
	} else {
		slog.Info("email entered", "email", t.credentials.TwitterEmail)
	}

	err = driver.WaitWithTimeout(func(wd selenium.WebDriver) (bool, error) {
		_, err := wd.FindElement(selenium.ByXPATH, twitterConfirmationCodeSpanSelector)
		if err != nil {
			return false, nil
		}
		return true, nil
	}, twitterSelectionTimeout)
	if err != nil {
		slog.Warn("failed to find possible verification code flow", "error", err)
	} else {
		slog.Info("found possible verification code flow")

		verificationCode, err := t.getVerificationCode(ctx)
		if err != nil {
			slog.Warn("failed to find verification code", "error", err)
		}

		err = driver.WaitWithTimeout(func(wd selenium.WebDriver) (bool, error) {
			verificationCodeField, err := wd.FindElement(selenium.ByCSSSelector, twitterVerificationCodeSelector)
			if err != nil {
				return false, nil
			}
			if err := verificationCodeField.SendKeys(verificationCode + selenium.EnterKey); err != nil {
				return false, err
			}
			return true, nil
		}, twitterSelectionTimeout)
		if err != nil {
			return fmt.Errorf("failed to find or interact with verification code field: %v", err)
		}
		slog.Info("verification code entered", "code", verificationCode)
	}

	slog.Info("waiting for login to complete", "delay", twitterLoginDelay)
	time.Sleep(twitterLoginDelay)

	url, err := driver.CurrentURL()
	if err != nil {
		return fmt.Errorf("failed to get current URL: %v", err)
	}
	if strings.HasPrefix(url, twitterLoginUrl) {
		slog.Error("URL indicates login did not complete", "url", url)
		return fmt.Errorf("unsuccessful login")
	}

	return nil
}

func (t *TwitterEncumberer) SetNewPassword(ctx context.Context, driver *selenium_utils.SeleniumDriver, newPassword string) error {
	slog.Info("navigating to password settings", "url", twitterPasswordUrl)
	if err := driver.Get(twitterPasswordUrl); err != nil {
		return fmt.Errorf("failed to navigate to password settings: %v", err)
	}

	slog.Info("waiting for input delay", "delay", twitterInputDelay)
	time.Sleep(twitterInputDelay)

	err := driver.WaitWithTimeout(func(wd selenium.WebDriver) (bool, error) {
		currentPwdField, err := wd.FindElement(selenium.ByName, twitterCurrentPasswordName)
		if err != nil {
			return false, nil
		}
		if err := currentPwdField.SendKeys(t.credentials.TwitterPassword); err != nil {
			return false, err
		}
		return true, nil
	}, twitterSelectionTimeout)
	if err != nil {
		return fmt.Errorf("failed to find or interact with current password field: %v", err)
	}
	slog.Info("current password entered")

	err = driver.WaitWithTimeout(func(wd selenium.WebDriver) (bool, error) {
		newPwdField, err := wd.FindElement(selenium.ByName, twitterNewPasswordName)
		if err != nil {
			return false, nil
		}
		if err := newPwdField.SendKeys(newPassword); err != nil {
			return false, err
		}
		return true, nil
	}, twitterSelectionTimeout)
	if err != nil {
		return fmt.Errorf("failed to find or interact with new password field: %v", err)
	}
	slog.Info("new password entered")

	err = driver.WaitWithTimeout(func(wd selenium.WebDriver) (bool, error) {
		confirmPwdField, err := wd.FindElement(selenium.ByName, twitterConfirmPasswordName)
		if err != nil {
			return false, nil
		}
		if err := confirmPwdField.SendKeys(newPassword); err != nil {
			return false, err
		}
		return true, nil
	}, twitterSelectionTimeout)
	if err != nil {
		return fmt.Errorf("failed to find or interact with confirm password field: %v", err)
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
		return fmt.Errorf("failed to find or click submit button: %v", err)
	}
	slog.Info("password change submitted")

	time.Sleep(twitterLoginDelay)

	return nil
}

func (t *TwitterEncumberer) GetCookies(ctx context.Context, driver *selenium_utils.SeleniumDriver) (string, error) {
	slog.Info("retrieving twitter authentication cookies")
	ct0Cookie, err := driver.GetCookie("ct0")
	if err != nil {
		return "", fmt.Errorf("failed to get ct0 cookie: %v", err)
	}
	slog.Info("retrieved ct0 cookie")

	authTokenCookie, err := driver.GetCookie("auth_token")
	if err != nil {
		return "", fmt.Errorf("failed to get auth_token cookie: %v", err)
	}
	slog.Info("retrieved auth_token cookie")

	authTokens, err := json.Marshal(TwitterAuthTokens{
		CT0:       ct0Cookie.Value,
		AuthToken: authTokenCookie.Value,
	})
	if err != nil {
		return "", fmt.Errorf("failed to marshal tokens: %v", err)
	}
	slog.Info("marshalled auth tokens")

	return string(authTokens), nil
}

func (t *TwitterEncumberer) GetAccessKeys(ctx context.Context, driver *selenium_utils.SeleniumDriver) (*OAuthTokenPair, error) {
	slog.Info("starting twitter login server", "ip", t.loginServerIp, "port", t.loginServerPort)
	twitterLoginServer := NewTwitterLoginServer(t.loginServerIp, t.loginServerPort, t.credentials.TwitterAppKey, t.credentials.TwitterAppSecret, t.debug)
	twitterLoginServer.Start()

	slog.Info("navigating to login", "url", twitterLoginServer.GetLoginRoute())
	if err := driver.Get(twitterLoginServer.GetLoginRoute()); err != nil {
		return nil, fmt.Errorf("failed to navigate to login endpoint: %v", err)
	}

	slog.Info("waiting for page to load", "delay", twitterNavigationDelay)
	time.Sleep(twitterNavigationDelay)

	err := driver.WaitWithTimeout(func(wd selenium.WebDriver) (bool, error) {
		allowButton, err := wd.FindElement(selenium.ByCSSSelector, `input[id="allow"]`)
		if err != nil {
			return false, nil
		}
		return true, allowButton.Click()
	}, twitterSelectionTimeout)
	if err != nil {
		slog.Warn("failed to find or click allow button", "error", err)
	} else {
		slog.Info("clicked allow button")
	}

	slog.Info("waiting for token pair")
	tokenPair, err := twitterLoginServer.WaitForTokenPair(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to get token pair: %v", err)
	}
	slog.Info("received token pair")

	return tokenPair, nil
}

func (t *TwitterEncumberer) Encumber(ctx context.Context) (*TwitterEncumbererOutput, error) {
	slog.Info("starting twitter encumbrance process")
	driver, err := selenium_utils.NewSeleniumDriver(seleniumPort)
	if err != nil {
		return nil, fmt.Errorf("failed to create selenium driver: %v", err)
	}
	defer driver.Close()

	if err := t.Login(ctx, driver); err != nil {
		driver.Debug()
		return nil, fmt.Errorf("failed to login: %v", err)
	}
	slog.Info("successfully logged in to twitter")

	newPassword, err := password.GeneratePassword()
	if err != nil {
		return nil, fmt.Errorf("failed to generate new password: %v", err)
	}

	if t.debug {
		slog.Info("generated new twitter password", "password", newPassword)
	}

	if err := t.SetNewPassword(ctx, driver, newPassword); err != nil {
		driver.Debug()
		return nil, fmt.Errorf("failed to set new password: %v", err)
	}
	slog.Info("successfully changed twitter password")

	cookies, err := t.GetCookies(ctx, driver)
	if err != nil {
		return nil, fmt.Errorf("failed to get cookies: %v", err)
	}
	slog.Info("successfully retrieved twitter authentication cookies")

	accessKeys, err := t.GetAccessKeys(ctx, driver)
	if err != nil {
		return nil, fmt.Errorf("failed to get access keys: %v", err)
	}
	slog.Info("successfully retrieved twitter access keys")

	return &TwitterEncumbererOutput{
		NewPassword:    newPassword,
		AuthTokens:     cookies,
		OAuthTokenPair: accessKeys,
	}, nil
}
