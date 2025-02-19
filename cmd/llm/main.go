package main

import (
	"context"
	"fmt"
	"os"
	"time"

	"github.com/briandowns/spinner"
	"github.com/fatih/color"
	"github.com/sashabaranov/go-openai"
	"github.com/spf13/cobra"

	"github.com/NethermindEth/teeception/pkg/agent/chat"
)

var (
	success = color.New(color.FgGreen).SprintFunc()
	fail    = color.New(color.FgRed).SprintFunc()
	info    = color.New(color.FgCyan).SprintFunc()
	warn    = color.New(color.FgYellow).SprintFunc()
)

type ChatParams struct {
	APIURL       string
	AuthToken    string
	Model        string
	SystemPrompt string
	Prompt       string
}

func executeChat(params ChatParams) (*chat.ChatCompletionResponse, error) {
	s := spinner.New(spinner.CharSets[14], 100*time.Millisecond)

	fmt.Printf("\n%s Starting chat completion...\n", info("💬"))

	clientConfig := openai.DefaultConfig(params.AuthToken)
	clientConfig.BaseURL = params.APIURL

	s.Suffix = " Creating chat client..."
	s.Start()
	client := openai.NewClientWithConfig(clientConfig)
	chatClient := chat.NewOpenAIChatCompletion(chat.OpenAIChatCompletionConfig{
		Client: client,
		Model:  params.Model,
	})
	s.Stop()
	fmt.Printf("%s Chat client created successfully\n", success("✓"))

	s.Suffix = " Sending prompt..."
	s.Start()
	ctx := context.Background()
	response, err := chatClient.Prompt(ctx, "", params.SystemPrompt, params.Prompt)
	s.Stop()
	if err != nil {
		fmt.Printf("%s Failed to send prompt\n", fail("❌"))
		return nil, fmt.Errorf("failed to send prompt: %w", err)
	}
	fmt.Printf("%s Prompt executed successfully\n", success("✓"))

	return response, nil
}

func main() {
	var apiURL string
	var authToken string
	var model string
	var systemPrompt string
	var prompt string

	rootCmd := &cobra.Command{
		Use:   "llm",
		Short: "Interact with LLM models",
		Run: func(cmd *cobra.Command, args []string) {
			fmt.Printf("\n%s Starting LLM interaction...\n", info("🚀"))

			params := ChatParams{
				APIURL:       apiURL,
				AuthToken:    authToken,
				Model:        model,
				SystemPrompt: systemPrompt,
				Prompt:       prompt,
			}

			response, err := executeChat(params)
			if err != nil {
				fmt.Printf("\n%s Error executing chat: %v\n", fail("❌"), err)
				os.Exit(1)
			}

			fmt.Printf("\n%s Response:\n", info("📄"))
			fmt.Println(color.New(color.FgYellow).Sprint(response.Response))

			if response.Drain != nil {
				fmt.Printf("\n%s Drain call detected:\n", warn("⚠️"))
				fmt.Printf("Address: %s\n", color.New(color.FgYellow).Sprint(response.Drain.Address))
			} else {
				fmt.Printf("\n%s No drain call detected\n", success("✅"))
			}

			fmt.Printf("\n%s Chat completed successfully!\n\n", success("✅"))
		},
	}

	rootCmd.Flags().StringVar(&apiURL, "api-url", "https://api.openai.com/v1", "API URL for the LLM service")
	rootCmd.Flags().StringVar(&authToken, "auth-token", "", "Authentication token for the LLM service")
	rootCmd.Flags().StringVar(&model, "model", "gpt-4", "Model to use for completion")
	rootCmd.Flags().StringVar(&systemPrompt, "system-prompt", "", "System prompt/instructions")
	rootCmd.Flags().StringVar(&prompt, "prompt", "", "User prompt to execute")

	rootCmd.MarkFlagRequired("auth-token")
	rootCmd.MarkFlagRequired("prompt")

	if err := rootCmd.Execute(); err != nil {
		fmt.Printf("%s %v\n", fail("❌"), err)
		os.Exit(1)
	}
}
