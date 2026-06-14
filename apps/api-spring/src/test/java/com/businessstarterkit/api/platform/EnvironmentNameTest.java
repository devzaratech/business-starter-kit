package com.businessstarterkit.api.platform;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class EnvironmentNameTest {

    @Test
    void parsesSupportedEnvironmentNames() {
        assertEquals(EnvironmentName.LOCAL, EnvironmentName.from("local"));
        assertEquals(EnvironmentName.DEV, EnvironmentName.from("DEV"));
        assertEquals(EnvironmentName.QA, EnvironmentName.from("qa"));
        assertEquals(EnvironmentName.UAT, EnvironmentName.from("uat"));
        assertEquals(EnvironmentName.STAGING, EnvironmentName.from("staging"));
        assertEquals(EnvironmentName.PROD, EnvironmentName.from("prod"));
    }

    @Test
    void rejectsUnsupportedEnvironmentNames() {
        assertThrows(IllegalArgumentException.class, () -> EnvironmentName.from("sandbox"));
    }
}
