package setup

import (
	"fmt"
	"log/slog"
	"time"

	"github.com/sethvargo/go-password/password"
	"github.com/tebeka/selenium"
)

const (
	protonLoginUrl    = "https://account.proton.me/"
	protonPasswordUrl = "https://account.proton.me/u/0/mail/account-password"

	protonUsernameElementId = "username"
	protonPasswordElementId = "password"
	protonNewPwdElementId   = "newPassword"
	protonConfirmElementId  = "confirmPassword"

	protonChangeButtonXpath = "//button[contains(text(), 'Change password')]"

	protonWaitTimeout     = 30 * time.Second
	protonSleepDelay      = 5 * time.Second
	protonLoginDelay      = 15 * time.Second
	protonNavigationDelay = 30 * time.Second

	seleniumInputDelay = 2 * time.Second
)

func (m *SetupManager) ChangeProtonPassword() (string, error) {
	driver, err := NewSeleniumDriver()
	if err != nil {
		return "", fmt.Errorf("failed to create selenium driver: %v", err)
	}
	defer driver.Close()

	if err := driver.Get(protonLoginUrl); err != nil {
		return "", fmt.Errorf("failed to navigate to login page: %v", err)
	}

	time.Sleep(protonNavigationDelay)

	err = driver.WaitWithTimeout(func(wd selenium.WebDriver) (bool, error) {
		username, err := wd.FindElement(selenium.ByID, protonUsernameElementId)
		if err != nil {
			return false, nil
		}
		time.Sleep(seleniumInputDelay)
		if err := username.SendKeys(m.protonEmail); err != nil {
			return false, err
		}
		return true, nil
	}, protonWaitTimeout)
	if err != nil {
		return "", fmt.Errorf("failed to find or interact with username field: %v", err)
	}
	slog.Info("username entered")

	err = driver.WaitWithTimeout(func(wd selenium.WebDriver) (bool, error) {
		password, err := wd.FindElement(selenium.ByID, protonPasswordElementId)
		if err != nil {
			return false, nil
		}
		time.Sleep(seleniumInputDelay)
		if err := password.SendKeys(m.protonPassword); err != nil {
			return false, err
		}
		if err := password.Submit(); err != nil {
			return false, err
		}
		return true, nil
	}, protonWaitTimeout)
	if err != nil {
		return "", fmt.Errorf("failed to find or interact with password field: %v", err)
	}
	slog.Info("password entered")

	time.Sleep(protonSleepDelay)

	if err := driver.Get(protonPasswordUrl); err != nil {
		return "", fmt.Errorf("failed to navigate to password settings: %v", err)
	}

	time.Sleep(protonNavigationDelay)

	err = driver.WaitWithTimeout(func(wd selenium.WebDriver) (bool, error) {
		button, err := wd.FindElement(selenium.ByXPATH, protonChangeButtonXpath)
		if err != nil {
			return false, nil
		}
		if err := button.Click(); err != nil {
			return false, err
		}
		return true, nil
	}, protonWaitTimeout)
	if err != nil {
		return "", fmt.Errorf("failed to find or click change password button: %v", err)
	}

	err = driver.WaitWithTimeout(func(wd selenium.WebDriver) (bool, error) {
		password, err := wd.FindElement(selenium.ByID, protonPasswordElementId)
		if err != nil {
			return false, nil
		}
		time.Sleep(seleniumInputDelay)
		if err := password.SendKeys(m.protonPassword); err != nil {
			return false, err
		}
		if err := password.Submit(); err != nil {
			return false, err
		}
		return true, nil
	}, protonWaitTimeout)
	if err != nil {
		return "", fmt.Errorf("failed to confirm current password: %v", err)
	}
	time.Sleep(protonSleepDelay)

	newPasswordStr, err := password.Generate(16, 4, 4, false, false)
	if err != nil {
		return "", fmt.Errorf("failed to generate new password: %v", err)
	}

	slog.Info("new password generated", "password", newPasswordStr)

	err = driver.WaitWithTimeout(func(wd selenium.WebDriver) (bool, error) {
		newPwd, err := wd.FindElement(selenium.ByID, protonNewPwdElementId)
		if err != nil {
			return false, nil
		}
		if err := newPwd.SendKeys(newPasswordStr); err != nil {
			return false, err
		}
		return true, nil
	}, protonWaitTimeout)
	if err != nil {
		return "", fmt.Errorf("failed to enter new password: %v", err)
	}

	err = driver.WaitWithTimeout(func(wd selenium.WebDriver) (bool, error) {
		confirm, err := wd.FindElement(selenium.ByID, protonConfirmElementId)
		if err != nil {
			return false, nil
		}
		if err := confirm.SendKeys(newPasswordStr); err != nil {
			return false, err
		}
		if err := confirm.Submit(); err != nil {
			return false, err
		}
		return true, nil
	}, protonWaitTimeout)
	if err != nil {
		return "", fmt.Errorf("failed to confirm new password: %v", err)
	}

	time.Sleep(protonLoginDelay)

	return newPasswordStr, nil
}
