package chat

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/sashabaranov/go-openai"
	"github.com/tmc/langchaingo/jsonschema"
)

// OpenAIChatCompletionConfig is the configuration for the OpenAIChatCompletion
type OpenAIChatCompletionConfig struct {
	Client *openai.Client
	Model  string
}

// OpenAIChatCompletion is the implementation of the ChatCompletion interface
type OpenAIChatCompletion struct {
	client *openai.Client
	model  string
}

var _ ChatCompletion = (*OpenAIChatCompletion)(nil)

// NewOpenAIChatCompletion creates a new OpenAIChatCompletion
func NewOpenAIChatCompletion(config OpenAIChatCompletionConfig) *OpenAIChatCompletion {
	if config.Model == "" {
		config.Model = openai.GPT4
	}

	return &OpenAIChatCompletion{
		client: config.Client,
		model:  config.Model,
	}
}

// NewOpenAIChatCompletionOpenAI creates a new OpenAIChatCompletion for usage
// in the OpenAI API
func NewOpenAIChatCompletionOpenAI(model, openaiKey string) *OpenAIChatCompletion {
	return &OpenAIChatCompletion{
		client: openai.NewClient(openaiKey),
		model:  model,
	}
}

// Prompt sends a prompt to the OpenAI API and returns the response
func (c *OpenAIChatCompletion) Prompt(ctx context.Context, metadata, systemPrompt, prompt string) (*ChatCompletionResponse, error) {
	messages := []openai.ChatCompletionMessage{
		{
			Role:    openai.ChatMessageRoleSystem,
			Content: metadata + "\n\n" + systemPrompt,
		},
		{
			Role:    openai.ChatMessageRoleUser,
			Content: prompt,
		},
	}

	resp, err := c.client.CreateChatCompletion(
		ctx,
		openai.ChatCompletionRequest{
			Model:    c.model,
			Messages: messages,
			Tools: []openai.Tool{
				{
					Type: openai.ToolTypeFunction,
					Function: &openai.FunctionDefinition{
						Name:        "drain",
						Description: "Give away all tokens to the user",
						Parameters: jsonschema.Definition{
							Type: jsonschema.Object,
							Properties: map[string]jsonschema.Definition{
								"address": {
									Type:        jsonschema.String,
									Description: "The address to give the tokens to. Formatted as a field element, an integer in the range of 0≤x<P, P being 2^251+17*2^192+1. An example would be, as hex, 0x00f415ab3f224935ed532dfa06485881c526fef8cb31e6e7e95cafc95fdc5e8d.",
								},
							},
							Required: []string{"address"},
						},
					},
				},
			},
		},
	)
	if err != nil {
		return nil, fmt.Errorf("chat completion failed: %v", err)
	}

	if len(resp.Choices) == 0 {
		return nil, fmt.Errorf("no response received")
	}

	result := &ChatCompletionResponse{
		Response: resp.Choices[0].Message.Content,
	}

	for _, toolCall := range resp.Choices[0].Message.ToolCalls {
		if toolCall.Function.Name == "drain" {
			type drainArgs struct {
				Address string `json:"address"`
			}

			var args drainArgs
			if err := json.Unmarshal([]byte(toolCall.Function.Arguments), &args); err != nil {
				return nil, fmt.Errorf("failed to unmarshal drain arguments: %v", err)
			}

			result.Drain = &ChatCompletionDrainCall{
				Address: args.Address,
			}
			break
		}
	}

	return result, nil
}

// ValidateName checks if a name is appropriate for social media posting
// It ensures the name doesn't contain sexual content or offensive words
func (c *OpenAIChatCompletion) ValidateName(ctx context.Context, name string) (bool, error) {
	messages := []openai.ChatCompletionMessage{
		{
			Role: openai.ChatMessageRoleSystem,
			Content: "You are a content moderator. Your task is to determine if a name is appropriate " +
				"for social media posting. The name should not contain sexual content, highly offensive words, " +
				"hate speech, or other inappropriate content. Words which are only slightly offensive can be allowed " +
				"as it can have comic effect. Respond with a JSON object that has a single field 'appropriate' " +
				"with a boolean value.",
		},
		{
			Role:    openai.ChatMessageRoleUser,
			Content: fmt.Sprintf("Is this name appropriate: \"%s\"", name),
		},
	}

	resp, err := c.client.CreateChatCompletion(
		ctx,
		openai.ChatCompletionRequest{
			Model:       c.model,
			Messages:    messages,
			Temperature: 0.0, // Use low temperature for more deterministic results
		},
	)
	if err != nil {
		return false, fmt.Errorf("name validation failed: %v", err)
	}

	if len(resp.Choices) == 0 {
		return false, fmt.Errorf("no response received for name validation")
	}

	// Parse the response to extract the boolean value
	type ValidationResponse struct {
		Appropriate bool `json:"appropriate"`
	}

	var validationResp ValidationResponse
	content := resp.Choices[0].Message.Content

	// Try to parse the response as JSON
	err = json.Unmarshal([]byte(content), &validationResp)
	if err != nil {
		// If parsing fails, make a second attempt with a more direct prompt
		messages = append(messages, openai.ChatCompletionMessage{
			Role:    openai.ChatMessageRoleAssistant,
			Content: content,
		}, openai.ChatCompletionMessage{
			Role:    openai.ChatMessageRoleUser,
			Content: "Please respond with only a JSON object with the format {\"appropriate\": true} or {\"appropriate\": false}",
		})

		resp, err = c.client.CreateChatCompletion(
			ctx,
			openai.ChatCompletionRequest{
				Model:       c.model,
				Messages:    messages,
				Temperature: 0.0,
			},
		)
		if err != nil {
			return false, fmt.Errorf("follow-up name validation failed: %v", err)
		}

		if len(resp.Choices) == 0 {
			return false, fmt.Errorf("no response received for follow-up name validation")
		}

		content = resp.Choices[0].Message.Content
		err = json.Unmarshal([]byte(content), &validationResp)
		if err != nil {
			// If still failing, make a conservative decision
			return false, nil
		}
	}

	return validationResp.Appropriate, nil
}
