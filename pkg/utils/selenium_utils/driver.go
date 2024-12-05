package selenium_utils

import (
	"fmt"
	"log/slog"

	"github.com/tebeka/selenium"
	"github.com/tebeka/selenium/chrome"
)

const (
	chromeDriverPath = "/usr/bin/chromedriver"
	chromeBinaryPath = "/usr/bin/chromium"
)

type SeleniumDriver struct {
	selenium.WebDriver
	service *selenium.Service
}

func NewSeleniumDriver(port int) (*SeleniumDriver, error) {
	opts := []selenium.ServiceOption{}
	caps := selenium.Capabilities{
		"browserName": "chrome",
	}
	chromeCaps := chrome.Capabilities{
		Args: []string{
			"--start-maximized",
			"--disable-dev-shm-usage",
			"--no-sandbox",
			"--headless",
		},
		Path: chromeBinaryPath,
	}
	caps.AddChrome(chromeCaps)

	service, err := selenium.NewChromeDriverService(chromeDriverPath, port, opts...)
	if err != nil {
		return nil, fmt.Errorf("failed to create chrome driver service: %v", err)
	}

	driver, err := selenium.NewRemote(caps, fmt.Sprintf("http://localhost:%d/wd/hub", port))
	if err != nil {
		return nil, fmt.Errorf("failed to create selenium driver: %v", err)
	}

	return &SeleniumDriver{
		WebDriver: driver,
		service:   service,
	}, nil
}

func (s *SeleniumDriver) Close() {
	s.service.Stop()
	s.WebDriver.Quit()
}

func (s *SeleniumDriver) Debug() error {
	url, err := s.CurrentURL()
	if err != nil {
		return fmt.Errorf("failed to get current url: %v", err)
	}

	source, err := s.PageSource()
	if err != nil {
		return fmt.Errorf("failed to get page source: %v", err)
	}

	slog.Info("=== debugging selenium driver ===")
	slog.Info("reading current source", "url", url)
	slog.Info(source)
	slog.Info("=================================")

	return nil
}
