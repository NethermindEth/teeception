// SPDX-License-Identifier: MIT

use core::hash::HashStateTrait;
use core::pedersen::PedersenTrait;

/// @notice Computes Pedersen hash of a ByteArray
/// @param value ByteArray to hash
/// @return The computed hash as a felt252
/// @dev Serializes ByteArray and hashes each felt252 element
pub fn hash_byte_array(value: @ByteArray) -> felt252 {
    let mut hasher = PedersenTrait::new(0);
    let mut serialized = ArrayTrait::<felt252>::new();

    value.serialize(ref serialized);

    let serialized_len = serialized.len();

    for i in 0..serialized_len {
        hasher = hasher.update(*serialized.at(i));
    };

    hasher.finalize()
}
