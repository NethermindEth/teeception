package quote

import (
	"bytes"
	"encoding/binary"
	"encoding/json"

	"github.com/NethermindEth/juno/core/felt"
)

// ReportData is the data that is sent to the Quoter to get a quote.
type ReportData struct {
	Address         *felt.Felt
	ContractAddress *felt.Felt
	TwitterUsername string
}

// MarshalJSON marshals the ReportData to JSON.
func (r *ReportData) MarshalJSON() ([]byte, error) {
	return json.Marshal(map[string]string{
		"address":         r.Address.String(),
		"contract":        r.ContractAddress.String(),
		"twitterUsername": r.TwitterUsername,
	})
}

// MarshalBinary marshals the ReportData to binary.
func (r *ReportData) MarshalBinary() ([]byte, error) {
	writer := bytes.NewBuffer([]byte{})

	binary.Write(writer, binary.BigEndian, r.Address.Bytes())
	binary.Write(writer, binary.BigEndian, r.ContractAddress.Bytes())
	binary.Write(writer, binary.BigEndian, []byte(r.TwitterUsername))

	return writer.Bytes(), nil
}
