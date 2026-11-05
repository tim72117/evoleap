package plans

import "testing"

func TestCatalogIsValid(t *testing.T) {
	if err := Catalog.Validate(); err != nil {
		t.Fatal(err)
	}
}
