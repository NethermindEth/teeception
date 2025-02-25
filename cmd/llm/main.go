package main

import (
	"context"
	"crypto/rand"
	"fmt"
	"os"
	"time"

	"github.com/briandowns/spinner"
	"github.com/fatih/color"
	"github.com/sashabaranov/go-openai"
	"github.com/spf13/cobra"

	"github.com/NethermindEth/juno/core/felt"
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
	metadata := buildMetadata()
	response, err := chatClient.Prompt(ctx, metadata, params.SystemPrompt, params.Prompt)
	s.Stop()
	if err != nil {
		fmt.Printf("%s Failed to send prompt\n", fail("❌"))
		return nil, fmt.Errorf("failed to send prompt: %w", err)
	}
	fmt.Printf("%s Prompt executed successfully\n", success("✓"))

	return response, nil
}

func validateName(apiURL, authToken, model, name string) (bool, error) {
	s := spinner.New(spinner.CharSets[14], 100*time.Millisecond)

	fmt.Printf("\n%s Validating name: %s\n", info("🔍"), name)

	clientConfig := openai.DefaultConfig(authToken)
	clientConfig.BaseURL = apiURL

	s.Suffix = " Creating chat client..."
	s.Start()
	client := openai.NewClientWithConfig(clientConfig)
	chatClient := chat.NewOpenAIChatCompletion(chat.OpenAIChatCompletionConfig{
		Client: client,
		Model:  model,
	})
	s.Stop()
	fmt.Printf("%s Chat client created successfully\n", success("✓"))

	s.Suffix = " Validating name..."
	s.Start()
	ctx := context.Background()
	valid, err := chatClient.ValidateName(ctx, name)
	s.Stop()
	if err != nil {
		fmt.Printf("%s Failed to validate name\n", fail("❌"))
		return false, fmt.Errorf("failed to validate name: %w", err)
	}

	if valid {
		fmt.Printf("%s Name is valid\n", success("✓"))
	} else {
		fmt.Printf("%s Name is invalid\n", fail("❌"))
	}

	return valid, nil
}

func buildMetadata() string {
	randomFelt := func() *felt.Felt {
		randomBytes := make([]byte, 32)
		rand.Read(randomBytes)
		return new(felt.Felt).SetBytes(randomBytes)
	}

	address := randomFelt()
	creator := randomFelt()
	user := randomFelt()

	return fmt.Sprintf(`
Your address: %s
Your creator address: %s
Responding to address: %s

You can either send a message or drain.
Don't expect the user to reply to your message.
Your reply must be at most 280 characters long.`,
		address.String(),
		creator.String(),
		user.String(),
	)
}

func main() {
	var apiURL string
	var authToken string
	var model string
	var systemPrompt string
	var prompt string
	var nameToValidate string

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

	validateCmd := &cobra.Command{
		Use:   "validate-name",
		Short: "Validate a name for appropriateness",
		Run: func(cmd *cobra.Command, args []string) {
			fmt.Printf("\n%s Starting name validation...\n", info("🚀"))

			valid, err := validateName(apiURL, authToken, model, nameToValidate)
			if err != nil {
				fmt.Printf("\n%s Error validating name: %v\n", fail("❌"), err)
				os.Exit(1)
			}

			fmt.Printf("\n%s Name validation result: %v\n\n", info("📄"), valid)
		},
	}

	rootCmd.PersistentFlags().StringVar(&apiURL, "api-url", "https://api.openai.com/v1", "API URL for the LLM service")
	rootCmd.PersistentFlags().StringVar(&authToken, "auth-token", "", "Authentication token for the LLM service")
	rootCmd.PersistentFlags().StringVar(&model, "model", "gpt-4", "Model to use for completion")

	rootCmd.Flags().StringVar(&systemPrompt, "system-prompt", "", "System prompt/instructions")
	rootCmd.Flags().StringVar(&prompt, "prompt", "", "User prompt to execute")

	validateCmd.Flags().StringVar(&nameToValidate, "name", "", "Name to validate")
	validateCmd.MarkFlagRequired("name")

	rootCmd.MarkPersistentFlagRequired("auth-token")
	rootCmd.MarkFlagRequired("prompt")

	rootCmd.AddCommand(validateCmd)

	if err := rootCmd.Execute(); err != nil {
		fmt.Printf("%s %v\n", fail("❌"), err)
		os.Exit(1)
	}
}
