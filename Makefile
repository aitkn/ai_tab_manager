.PHONY: release release-major release-minor release-patch help

# Default target
help:
	@echo "Available commands:"
	@echo "  make release       - Auto-increment minor version and create release"
	@echo "  make release-major - Increment major version (1.0.0 -> 2.0.0)"
	@echo "  make release-minor - Increment minor version (1.0.0 -> 1.1.0)"
	@echo "  make release-patch - Increment patch version (1.0.0 -> 1.0.1)"

# Default release (minor version bump)
release:
	@./release-auto.sh minor

release-major:
	@./release-auto.sh major

release-minor:
	@./release-auto.sh minor

release-patch:
	@./release-auto.sh patch