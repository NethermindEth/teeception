use sncast_std::{ declare, deploy, DeclareResultTrait, get_nonce, FeeSettings, EthFeeSettings};

fn main() {
    let max_fee = 999999999999999;
    let salt = 0x3;

    // Declare Agent contract first
    let agent_declare_nonce = get_nonce('latest');
    let agent_declare_result = declare(
        "Agent",
        FeeSettings::Eth(EthFeeSettings { max_fee: Option::Some(max_fee) }),
        Option::Some(agent_declare_nonce)
    )
        .expect('agent declare failed');

    let agent_class_hash = agent_declare_result.class_hash();

    // Declare and deploy AgentRegistry
    let registry_declare_nonce = get_nonce('pending');
    let registry_declare_result = declare(
        "AgentRegistry",
        FeeSettings::Eth(EthFeeSettings { max_fee: Option::Some(max_fee) }),
        Option::Some(registry_declare_nonce)
    )
        .expect('registry declare failed');

    let registry_class_hash = registry_declare_result.class_hash();

    let mut registry_constructor = ArrayTrait::new();
    registry_constructor.append((*agent_class_hash).into());
    registry_constructor.append(token_deploy_result.contract_address.into());

    let registry_deploy_nonce = get_nonce('pending');
    let registry_deploy_result = deploy(
        *registry_class_hash,
        registry_constructor,
        Option::Some(salt),
        true,
        FeeSettings::Eth(EthFeeSettings { max_fee: Option::Some(max_fee) }),
        Option::Some(registry_deploy_nonce)
    )
        .expect('registry deploy failed');

    assert(registry_deploy_result.transaction_hash != 0, registry_deploy_result.transaction_hash);
}