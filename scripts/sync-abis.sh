#!/bin/bash

# Ensure jq is installed
if ! command -v jq &> /dev/null; then
    echo "Error: jq is required but not installed. Please install it first:"
    echo "  Homebrew: brew install jq"
    echo "  Ubuntu: sudo apt-get install jq"
    exit 1
fi

# Set paths
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
CONTRACT_DIR="$SCRIPT_DIR/../contracts/target/release"
ABI_DIR="$SCRIPT_DIR/../extension/src/abis"

# Create ABI directory if it doesn't exist
mkdir -p "$ABI_DIR"

# Process each contract class file
for contract_file in "$CONTRACT_DIR"/*.contract_class.json; do
    if [ ! -f "$contract_file" ]; then
        echo "No contract class files found"
        exit 0
    fi

    # Extract contract name and create ABI name
    filename=$(basename "$contract_file")
    contract_name=${filename%.contract_class.json}
    abi_name=$(echo "$contract_name" | tr '[:lower:]' '[:upper:]')_ABI
    output_file="$ABI_DIR/${abi_name}.ts"

    # Extract ABI and format as TypeScript export
    echo "export const ${abi_name} = $(jq '.abi' "$contract_file") as const;" > "$output_file"
    
    echo "Updated $output_file"
done 