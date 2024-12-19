package graphql

// DefaultFeatures returns the default feature flags used by Twitter's GraphQL API
func DefaultFeatures() map[string]bool {
	return map[string]bool{
		"responsive_web_graphql_exclude_directive_enabled":   true,
		"verified_phone_label_enabled":                      false,
		"creator_subscriptions_tweet_preview_api_enabled":   true,
		"longform_notetweets_consumption_enabled":           true,
		"tweet_awards_web_tipping_enabled":                  false,
		"freedom_of_speech_not_reach_fetch_enabled":         true,
		"standardized_nudges_misinfo":                       true,
		"longform_notetweets_rich_text_read_enabled":        true,
		"longform_notetweets_inline_media_enabled":          true,
		"responsive_web_enhance_cards_enabled":              false,
	}
}
