package main

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"time"

	"github.com/Dstack-TEE/dstack/sdk/go/tappd"
	"github.com/PuerkitoBio/goquery"
	"github.com/briandowns/spinner"
	"github.com/edgelesssys/go-tdx-qpl/verification/types"
	"github.com/fatih/color"
	"github.com/spf13/cobra"

	"github.com/NethermindEth/juno/core/felt"

	"github.com/NethermindEth/teeception/backend/pkg/agent/quote"
)

var (
	success = color.New(color.FgGreen).SprintFunc()
	fail    = color.New(color.FgRed).SprintFunc()
	info    = color.New(color.FgCyan).SprintFunc()
	warn    = color.New(color.FgYellow).SprintFunc()
)

type QuoteData struct {
	Quote      types.SGXQuote4
	QuoteBytes []byte
	ReportData quote.ReportData
}

type EventLogEntry struct {
	Event        string `json:"event"`
	EventPayload string `json:"event_payload"`
}

func parseResponse(response string) (QuoteData, error) {
	type quoteResponse struct {
		Quote      string `json:"quote"`
		ReportData struct {
			Address         string `json:"address"`
			ContractAddress string `json:"contract_address"`
			TwitterUsername string `json:"twitter_username"`
		} `json:"report_data"`
	}

	var decodedResponse quoteResponse
	err := json.Unmarshal([]byte(response), &decodedResponse)
	if err != nil {
		return QuoteData{}, fmt.Errorf("failed to unmarshal response: %w", err)
	}

	address, err := new(felt.Felt).SetString(decodedResponse.ReportData.Address)
	if err != nil {
		return QuoteData{}, fmt.Errorf("failed to parse address: %w", err)
	}

	contractAddress, err := new(felt.Felt).SetString(decodedResponse.ReportData.ContractAddress)
	if err != nil {
		return QuoteData{}, fmt.Errorf("failed to parse contract address: %w", err)
	}

	reportData := quote.ReportData{
		Address:         address,
		ContractAddress: contractAddress,
		TwitterUsername: decodedResponse.ReportData.TwitterUsername,
	}

	quote, err := hex.DecodeString(decodedResponse.Quote)
	if err != nil {
		return QuoteData{}, fmt.Errorf("failed to decode quote: %w", err)
	}

	parsedQuote, err := types.ParseQuote(quote)
	if err != nil {
		return QuoteData{}, fmt.Errorf("failed to parse quote: %w", err)
	}

	return QuoteData{
		Quote:      parsedQuote,
		QuoteBytes: quote,
		ReportData: reportData,
	}, nil
}

type VerifyParams struct {
	QuoteBytes    []byte
	AppID         string
	BaseDstackURL string
}

func fetchAndParseHTML(appID, baseDstackURL string) (string, string, error) {
	url := fmt.Sprintf("https://%s-8090.%s", appID, baseDstackURL)
	resp, err := http.Get(url)
	if err != nil {
		return "", "", fmt.Errorf("failed to fetch HTML: %w", err)
	}
	defer resp.Body.Close()

	doc, err := goquery.NewDocumentFromReader(resp.Body)
	if err != nil {
		return "", "", fmt.Errorf("failed to parse HTML: %w", err)
	}

	tcbInfo := doc.Find("textarea").First().Text()
	appCert := doc.Find("textarea").Last().Text()

	return tcbInfo, appCert, nil
}

func calculateComposeHash(compose string) string {
	return fmt.Sprintf("%x", sha256.Sum256([]byte(compose)))
}

func parseEventLog(eventLog string) ([]EventLogEntry, error) {
	var events []EventLogEntry
	if err := json.Unmarshal([]byte(eventLog), &events); err != nil {
		return nil, fmt.Errorf("failed to parse event log: %w", err)
	}
	return events, nil
}

func findEventPayload(events []EventLogEntry, eventName string) (string, error) {
	for _, event := range events {
		if event.Event == eventName {
			return event.EventPayload, nil
		}
	}
	return "", fmt.Errorf("%s event not found in event log", eventName)
}

func findComposeHashFromEventLog(events []EventLogEntry) (string, error) {
	return findEventPayload(events, "compose-hash")
}

func findAppIDFromEventLog(events []EventLogEntry) (string, error) {
	return findEventPayload(events, "app-id")
}

func verify(params VerifyParams) (QuoteData, error) {
	s := spinner.New(spinner.CharSets[14], 100*time.Millisecond)

	fmt.Printf("\n%s Starting verification process...\n", info("🔍"))

	s.Suffix = " Parsing quote response..."
	s.Start()
	quoteData, err := parseResponse(string(params.QuoteBytes))
	s.Stop()
	if err != nil {
		fmt.Printf("%s Failed to parse quote response\n", fail("❌"))
		return QuoteData{}, fmt.Errorf("failed to parse quote response: %w", err)
	}
	fmt.Printf("%s Quote response parsed successfully\n", success("✓"))

	s.Suffix = " Fetching and parsing HTML..."
	s.Start()
	tcbInfo, _, err := fetchAndParseHTML(params.AppID, params.BaseDstackURL)
	s.Stop()
	if err != nil {
		fmt.Printf("%s Failed to fetch and parse HTML\n", fail("❌"))
		return QuoteData{}, fmt.Errorf("failed to fetch and parse HTML: %w", err)
	}
	fmt.Printf("%s Instance info fetched and parsed successfully\n", success("✓"))

	var tcbInfoData struct {
		MRTD       string          `json:"mrtd"`
		EventLog   json.RawMessage `json:"event_log"`
		AppCompose string          `json:"app_compose"`
	}
	if err := json.Unmarshal([]byte(tcbInfo), &tcbInfoData); err != nil {
		fmt.Printf("%s Failed to parse TCB info\n", fail("❌"))
		return QuoteData{}, fmt.Errorf("failed to parse TCB info: %w", err)
	}
	parsedEventLog, err := parseEventLog(string(tcbInfoData.EventLog))
	if err != nil {
		return QuoteData{}, fmt.Errorf("failed to parse event log: %w", err)
	}

	s.Suffix = " Replaying RTMRs..."
	s.Start()
	mockResp := tappd.TdxQuoteResponse{
		EventLog: string(tcbInfoData.EventLog),
	}
	rtmrs, err := mockResp.ReplayRTMRs()
	s.Stop()
	if err != nil {
		fmt.Printf("%s Failed to replay RTMRs\n", fail("❌"))
		return QuoteData{}, fmt.Errorf("failed to replay RTMRs: %w", err)
	}
	fmt.Printf("%s RTMRs replayed successfully\n", success("✓"))

	fmt.Printf("\n%s Calculated RTMRs:\n", info("📊"))
	for i, rtmr := range rtmrs {
		fmt.Printf("RTMR%d: %s\n", i, rtmr)
	}

	fmt.Printf("\n%s Quote RTMRs:\n", info("📊"))
	for i, rtmr := range quoteData.Quote.Body.RTMR {
		fmt.Printf("RTMR%d: %x\n", i, rtmr)
	}

	for i, rtmr := range rtmrs {
		if hex.EncodeToString(quoteData.Quote.Body.RTMR[i][:]) != rtmr {
			fmt.Printf("%s RTMR%d mismatch\n", fail("❌"), i)
			return QuoteData{}, fmt.Errorf("RTMR%d mismatch, expected %v, got %v", i, rtmr, hex.EncodeToString(quoteData.Quote.Body.RTMR[i][:]))
		}
	}
	fmt.Printf("%s RTMRs verified successfully\n", success("✓"))

	fmt.Printf("\n%s TCB MRTD:\n", info("📄"))
	fmt.Printf("%s\n", tcbInfoData.MRTD)

	fmt.Printf("\n%s Quote MRTD:\n", info("📄"))
	fmt.Printf("%s\n", hex.EncodeToString(quoteData.Quote.Body.MRTD[:]))

	if tcbInfoData.MRTD != hex.EncodeToString(quoteData.Quote.Body.MRTD[:]) {
		fmt.Printf("%s MRTD mismatch\n", fail("❌"))
		return QuoteData{}, fmt.Errorf("MRTD mismatch, expected %v, got %v", tcbInfoData.MRTD, hex.EncodeToString(quoteData.Quote.Body.MRTD[:]))
	}
	fmt.Printf("%s MRTD verified successfully\n", success("✓"))

	calculatedComposeHash := calculateComposeHash(tcbInfoData.AppCompose)
	eventLogComposeHash, err := findComposeHashFromEventLog(parsedEventLog)
	if err != nil {
		fmt.Printf("%s Failed to find compose hash in event log\n", fail("❌"))
		return QuoteData{}, fmt.Errorf("failed to find compose hash in event log: %w", err)
	}

	fmt.Printf("\n%s Compose Hash verification:\n", info("🔐"))
	fmt.Printf("Calculated: %s\n", calculatedComposeHash)
	fmt.Printf("Event log:  %s\n", eventLogComposeHash)

	if calculatedComposeHash != eventLogComposeHash {
		fmt.Printf("%s Compose hash mismatch\n", fail("❌"))
		return QuoteData{}, fmt.Errorf("compose hash mismatch, expected %v, got %v", eventLogComposeHash, calculatedComposeHash)
	}
	fmt.Printf("%s Compose hash verified successfully\n", success("✓"))

	eventLogAppID, err := findAppIDFromEventLog(parsedEventLog)
	if err != nil {
		fmt.Printf("%s Failed to find app ID in event log\n", fail("❌"))
		return QuoteData{}, fmt.Errorf("failed to find app ID in event log: %w", err)
	}

	fmt.Printf("\n%s App ID verification:\n", info("🔍"))
	fmt.Printf("Provided:  %s\n", params.AppID)
	fmt.Printf("Event log: %s\n", eventLogAppID)

	if params.AppID != eventLogAppID {
		fmt.Printf("%s App ID mismatch\n", fail("❌"))
		return QuoteData{}, fmt.Errorf("app ID mismatch, expected %v, got %v", eventLogAppID, params.AppID)
	}
	fmt.Printf("%s App ID verified successfully\n", success("✓"))

	fmt.Printf("\n%s Compose file used:\n", info("📄"))
	var appComposeData struct {
		DockerComposeFile string `json:"docker_compose_file"`
	}
	if err := json.Unmarshal([]byte(tcbInfoData.AppCompose), &appComposeData); err != nil {
		fmt.Printf("%s Failed to parse app compose\n", fail("❌"))
		return QuoteData{}, fmt.Errorf("failed to parse app compose: %w", err)
	}
	fmt.Printf("%s\n", color.New(color.FgYellow).Sprint(appComposeData.DockerComposeFile))

	fmt.Printf("\n%s Report Data:\n", info("📋"))
	fmt.Printf("TEE Address: %s\n", quoteData.ReportData.Address)
	fmt.Printf("AgentRegistry Address: %s\n", quoteData.ReportData.ContractAddress)
	fmt.Printf("Twitter Username: %s\n", quoteData.ReportData.TwitterUsername)

	return quoteData, nil
}

func main() {
	var quotePath string
	var appID string
	var baseDstackURL string
	var submit bool

	rootCmd := &cobra.Command{
		Use:   "verify",
		Short: "Verify a quote response",
		Run: func(cmd *cobra.Command, args []string) {
			fmt.Printf("\n%s Starting quote verification tool...\n", info("🚀"))

			quoteBytes, err := os.ReadFile(quotePath)
			if err != nil {
				fmt.Printf("%s Error reading quote file: %v\n", fail("❌"), err)
				os.Exit(1)
			}

			params := VerifyParams{
				QuoteBytes:    quoteBytes,
				AppID:         appID,
				BaseDstackURL: baseDstackURL,
			}

			valid := true
			quoteData, err := verify(params)
			if err != nil {
				fmt.Printf("\n%s Error verifying quote: %v\n", fail("❌"), err)
				valid = false
			}

			if valid {
				fmt.Printf("\n%s Quote parameters are valid! All checks passed.\n\n", success("✅"))

				explorerBaseURL := "https://ra-quote-explorer.vercel.app"
				if submit {
					s := spinner.New(spinner.CharSets[14], 100*time.Millisecond)
					s.Suffix = fmt.Sprintf(" Submitting quote to %s...", explorerBaseURL)
					s.Start()
					url := fmt.Sprintf("%s/r?hex=%s", explorerBaseURL, hex.EncodeToString(quoteData.QuoteBytes))

					resp, err := http.Get(url)
					if err != nil {
						fmt.Printf("\n%s Error submitting quote: %v\n", fail("❌"), err)
						os.Exit(1)
					}
					defer resp.Body.Close()

					if resp.StatusCode != 200 {
						fmt.Printf("\n%s Error submitting quote: %v\n", fail("❌"), resp.Status)
						os.Exit(1)
					}

					s.Stop()
					fmt.Printf("\n%s Quote submitted successfully: %s\n", success("✓"), resp.Request.URL)
				} else {
					fmt.Printf("\n%s Please verify the quote at %s\n", warn("⚠️"), explorerBaseURL)
				}
			} else {
				fmt.Printf("\n%s Quote parameters are invalid! Verification failed.\n", fail("❌"))
			}
		},
	}

	rootCmd.Flags().StringVarP(&quotePath, "quote", "q", "", "Path to quote response file")
	rootCmd.Flags().StringVar(&appID, "app-id", "", "Application ID")
	rootCmd.Flags().StringVar(&baseDstackURL, "base-dstack-url", "dstack-prod5.phala.network", "Base Dstack URL")
	rootCmd.Flags().BoolVar(&submit, "submit", false, "Submit quote to ra-quote-explorer")

	rootCmd.MarkFlagRequired("quote")
	rootCmd.MarkFlagRequired("app-id")

	if err := rootCmd.Execute(); err != nil {
		fmt.Printf("%s %v\n", fail("❌"), err)
		os.Exit(1)
	}
}
