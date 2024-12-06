package dstack

import (
	"bytes"
	"context"
	"crypto/sha512"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"os"
	"strings"
)

// DeriveKeyResponse represents the response from a key derivation request
type DeriveKeyResponse struct {
	Key              string   `json:"key"`
	CertificateChain []string `json:"certificate_chain"`
}

// ToBytes converts the key to bytes, optionally truncating to maxLength
func (d *DeriveKeyResponse) ToBytes(maxLength int) ([]byte, error) {
	content := strings.ReplaceAll(d.Key, "-----BEGIN PRIVATE KEY-----", "")
	content = strings.ReplaceAll(content, "-----END PRIVATE KEY-----", "")
	content = strings.ReplaceAll(content, "\n", "")

	binary, err := base64.StdEncoding.DecodeString(content)
	if err != nil {
		return nil, err
	}
	if maxLength <= 0 {
		return binary, nil
	}
	if len(binary) > maxLength {
		return binary[:maxLength], nil
	}
	return binary, nil
}

// TdxQuoteResponse represents the response from a TDX quote request
type TdxQuoteResponse struct {
	Quote    string `json:"quote"`
	EventLog string `json:"event_log"`
}

// GetEndpoint returns the appropriate endpoint based on environment and input
func GetEndpoint(endpoint string) string {
	if endpoint != "" {
		return endpoint
	}
	if simEndpoint, exists := os.LookupEnv("DSTACK_SIMULATOR_ENDPOINT"); exists {
		log.Printf("Using simulator endpoint: %s", simEndpoint)
		return simEndpoint
	}
	return "/var/run/tappd.sock"
}

// TappdClient handles communication with the Tappd service
type TappdClient struct {
	baseURL    string
	httpClient *http.Client
}

// NewTappdClient creates a new TappdClient instance
func NewTappdClient(endpoint string) *TappdClient {
	endpoint = GetEndpoint(endpoint)
	baseURL := endpoint
	httpClient := &http.Client{}

	if !strings.HasPrefix(endpoint, "http://") && !strings.HasPrefix(endpoint, "https://") {
		baseURL = "http://localhost"
		httpClient = &http.Client{
			Transport: &http.Transport{
				DialContext: func(_ context.Context, _, _ string) (net.Conn, error) {
					return net.Dial("unix", endpoint)
				},
			},
		}
	}

	return &TappdClient{
		baseURL:    baseURL,
		httpClient: httpClient,
	}
}

func (c *TappdClient) sendRPCRequest(path string, payload interface{}) ([]byte, error) {
	jsonData, err := json.Marshal(payload)
	if err != nil {
		return nil, err
	}

	req, err := http.NewRequest("POST", c.baseURL+path, bytes.NewBuffer(jsonData))
	if err != nil {
		return nil, err
	}

	req.Header.Set("Content-Type", "application/json")
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("unexpected status code: %d", resp.StatusCode)
	}

	return io.ReadAll(resp.Body)
}

// DeriveKey sends a key derivation request
func (c *TappdClient) DeriveKey(path, subject string) (*DeriveKeyResponse, error) {
	payload := map[string]string{
		"path":    path,
		"subject": subject,
	}

	data, err := c.sendRPCRequest("/prpc/Tappd.DeriveKey", payload)
	if err != nil {
		return nil, err
	}

	var response DeriveKeyResponse
	if err := json.Unmarshal(data, &response); err != nil {
		return nil, err
	}
	return &response, nil
}

// TdxQuote sends a TDX quote request
func (c *TappdClient) TdxQuote(reportData []byte) (*TdxQuoteResponse, error) {
	hash := sha512.Sum384(reportData)
	payload := map[string]string{
		"report_data": hex.EncodeToString(hash[:]),
	}

	data, err := c.sendRPCRequest("/prpc/Tappd.TdxQuote", payload)
	if err != nil {
		return nil, err
	}

	var response TdxQuoteResponse
	if err := json.Unmarshal(data, &response); err != nil {
		return nil, err
	}
	return &response, nil
}
