// Proton encumberance utilities
// Initially based on https://github.com/tee-he-he/err_err_ttyl/blob/a3f296a5caaf7f23afa20c8841da39fe18a275bd/scripts/protonmail.py
package proton

import (
	"context"
	"fmt"
	"log/slog"
	"strings"
	"time"

	"github.com/NethermindEth/teeception/pkg/agent/debug"
	"github.com/NethermindEth/teeception/pkg/agent/password"
	"github.com/NethermindEth/teeception/pkg/selenium_utils"
	"github.com/tebeka/selenium"
)

const (
	protonLoginUrl    = "https://account.proton.me/"
	protonMailUrl     = "https://mail.proton.me/u/0/inbox"
	protonPasswordUrl = "https://account.proton.me/u/0/mail/account-password"

	protonUsernameElementId = "username"
	protonPasswordElementId = "password"
	protonNewPwdElementId   = "newPassword"
	protonConfirmElementId  = "confirmPassword"

	protonChangeButtonXpath     = "//button[contains(text(), 'Change password')]"
	protonVerificationCodeXpath = "//span[contains(text(), 'Your X confirmation')]"

	protonWaitTimeout     = 30 * time.Second
	protonSleepDelay      = 5 * time.Second
	protonLoginDelay      = 15 * time.Second
	protonNavigationDelay = 30 * time.Second

	seleniumInputDelay = 2 * time.Second

	seleniumPort = 4445
)

type ProtonEncumberer struct {
	credentials ProtonEncumbererCredentials
}

type ProtonEncumbererCredentials struct {
	ProtonUsername string
	ProtonPassword string
}

type ProtonEncumbererOutput struct {
	NewPassword string
}

func NewProtonEncumberer(credentials ProtonEncumbererCredentials) *ProtonEncumberer {
	return &ProtonEncumberer{credentials: credentials}
}

func (p *ProtonEncumberer) Login(ctx context.Context, driver *selenium_utils.SeleniumDriver) error {
	slog.Info("attempting to login to proton", "url", protonLoginUrl)
	if err := driver.Get(protonLoginUrl); err != nil {
		return fmt.Errorf("failed to navigate to login page: %v", err)
	}

	slog.Info("waiting for page to load", "delay", protonNavigationDelay)
	time.Sleep(protonNavigationDelay)

	if err := driver.InteractWithElement(ctx, selenium.ByID, protonUsernameElementId, func(el selenium.WebElement) error {
		time.Sleep(seleniumInputDelay)
		return el.SendKeys(p.credentials.ProtonUsername)
	}, protonWaitTimeout); err != nil {
		return fmt.Errorf("failed to find or interact with username field: %v", err)
	}
	slog.Info("username entered", "username", p.credentials.ProtonUsername)

	if err := driver.InteractWithElement(ctx, selenium.ByID, protonPasswordElementId, func(el selenium.WebElement) error {
		time.Sleep(seleniumInputDelay)
		if err := el.SendKeys(p.credentials.ProtonPassword); err != nil {
			return err
		}
		return el.Submit()
	}, protonWaitTimeout); err != nil {
		return fmt.Errorf("failed to find or interact with password field: %v", err)
	}
	slog.Info("password entered and submitted", "password", p.credentials.ProtonPassword)

	slog.Info("waiting for login to complete", "delay", protonLoginDelay)
	time.Sleep(protonLoginDelay)

	return nil
}

func (p *ProtonEncumberer) SetNewPassword(ctx context.Context, driver *selenium_utils.SeleniumDriver, newPassword string) error {
	slog.Info("navigating to password settings", "url", protonPasswordUrl)
	if err := driver.Get(protonPasswordUrl); err != nil {
		return fmt.Errorf("failed to navigate to password settings: %v", err)
	}

	slog.Info("waiting for page to load", "delay", protonNavigationDelay)
	time.Sleep(protonNavigationDelay)

	if err := driver.InteractWithElement(ctx, selenium.ByXPATH, protonChangeButtonXpath, func(el selenium.WebElement) error {
		return el.Click()
	}, protonWaitTimeout); err != nil {
		return fmt.Errorf("failed to find or click change password button: %v", err)
	}
	slog.Info("clicked change password button")

	if err := driver.InteractWithElement(ctx, selenium.ByID, protonPasswordElementId, func(el selenium.WebElement) error {
		time.Sleep(seleniumInputDelay)
		if err := el.SendKeys(p.credentials.ProtonPassword); err != nil {
			return err
		}
		return el.Submit()
	}, protonWaitTimeout); err != nil {
		return fmt.Errorf("failed to confirm current password: %v", err)
	}
	slog.Info("current password confirmed")
	time.Sleep(protonSleepDelay)

	if err := driver.InteractWithElement(ctx, selenium.ByID, protonNewPwdElementId, func(el selenium.WebElement) error {
		return el.SendKeys(newPassword)
	}, protonWaitTimeout); err != nil {
		return fmt.Errorf("failed to enter new password: %v", err)
	}
	slog.Info("entered new password")

	if err := driver.InteractWithElement(ctx, selenium.ByID, protonConfirmElementId, func(el selenium.WebElement) error {
		if err := el.SendKeys(newPassword); err != nil {
			return err
		}
		return el.Submit()
	}, protonWaitTimeout); err != nil {
		return fmt.Errorf("failed to confirm new password: %v", err)
	}
	slog.Info("confirmed and submitted new password")

	slog.Info("waiting for password change to complete", "delay", protonLoginDelay)
	time.Sleep(protonLoginDelay)

	return nil
}

func (p *ProtonEncumberer) Encumber(ctx context.Context) (*ProtonEncumbererOutput, error) {
	slog.Info("starting proton encumbrance process")
	driver, err := selenium_utils.NewSeleniumDriver(seleniumPort)
	if err != nil {
		return nil, fmt.Errorf("failed to create selenium driver: %v", err)
	}
	defer driver.Close()

	if err := p.Login(ctx, driver); err != nil {
		driver.Debug()
		return nil, fmt.Errorf("failed to login: %v", err)
	}
	slog.Info("successfully logged in to proton")

	newPassword, err := password.GeneratePassword()
	if err != nil {
		return nil, fmt.Errorf("failed to generate new password: %v", err)
	}

	if debug.IsDebugShowPassword() {
		slog.Info("generated new proton password", "password", newPassword)
	}

	if err := p.SetNewPassword(ctx, driver, newPassword); err != nil {
		driver.Debug()
		return nil, fmt.Errorf("failed to set new password: %v", err)
	}
	slog.Info("successfully changed proton password")

	return &ProtonEncumbererOutput{
		NewPassword: newPassword,
	}, nil
}

func (p *ProtonEncumberer) GetTwitterVerificationCode(ctx context.Context) (string, error) {
	slog.Info("starting twitter verification code retrieval")
	driver, err := selenium_utils.NewSeleniumDriver(seleniumPort)
	if err != nil {
		return "", fmt.Errorf("failed to create selenium driver: %v", err)
	}
	defer driver.Close()

	if err := p.Login(ctx, driver); err != nil {
		driver.Debug()
		return "", fmt.Errorf("failed to login: %v", err)
	}
	slog.Info("successfully logged in to proton")

	var verificationCode string
	if err := driver.InteractWithElement(ctx, selenium.ByXPATH, protonVerificationCodeXpath, func(el selenium.WebElement) error {
		text, err := el.Text()
		if err != nil {
			return err
		}

		textParts := strings.Split(text, " ")
		verificationCode = textParts[len(textParts)-1]

		return nil
	}, protonWaitTimeout); err != nil {
		driver.Debug()
		return "", fmt.Errorf("failed to find verification code: %v", err)
	}

	if debug.IsDebugShowPassword() {
		slog.Info("found verification code", "code", verificationCode)
	}

	return verificationCode, nil
}
