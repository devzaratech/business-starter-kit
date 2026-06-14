package com.businessstarterkit.api.platform;

import java.util.Locale;
import java.util.Set;

public enum EnvironmentName {
    LOCAL,
    DEV,
    QA,
    UAT,
    STAGING,
    PROD;

    private static final Set<String> SUPPORTED_VALUES = Set.of("local", "dev", "qa", "uat", "staging", "prod");

    public static EnvironmentName from(String value) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException("Environment value must not be blank.");
        }

        String normalizedValue = value.trim().toLowerCase(Locale.ROOT);
        if (!SUPPORTED_VALUES.contains(normalizedValue)) {
            throw new IllegalArgumentException("Unsupported environment: " + value);
        }

        return EnvironmentName.valueOf(normalizedValue.toUpperCase(Locale.ROOT));
    }
}
