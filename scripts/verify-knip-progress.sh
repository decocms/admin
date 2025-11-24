#!/bin/bash
# Knip Cleanup Progress Verification Script

set -e

echo "========================================"
echo "Knip Cleanup Progress Verification"
echo "========================================"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo -e "${RED}Error: Must run from repository root${NC}"
    exit 1
fi

echo -e "${BLUE}Step 1: Running knip...${NC}"
echo ""

# Run knip and capture output
KNIP_OUTPUT=$(bun knip 2>&1) || true
KNIP_EXIT_CODE=$?

# Parse knip output
DUPLICATE_COUNT=$(echo "$KNIP_OUTPUT" | grep "Duplicate exports" | grep -o '[0-9]\+' | head -1 || echo "0")
UNUSED_COUNT=$(echo "$KNIP_OUTPUT" | grep "Unused exports" | grep -o '[0-9]\+' | head -1 || echo "0")

echo -e "${YELLOW}Knip Results:${NC}"
echo "  Duplicate exports: $DUPLICATE_COUNT"
echo "  Unused exports: $UNUSED_COUNT"
echo ""

# Calculate progress
TOTAL_INITIAL=299  # 17 duplicates + 282 unused
TOTAL_CURRENT=$((DUPLICATE_COUNT + UNUSED_COUNT))
TOTAL_FIXED=$((TOTAL_INITIAL - TOTAL_CURRENT))
PROGRESS_PERCENT=$((TOTAL_FIXED * 100 / TOTAL_INITIAL))

echo -e "${BLUE}Progress:${NC}"
echo "  Fixed: $TOTAL_FIXED / $TOTAL_INITIAL ($PROGRESS_PERCENT%)"
echo "  Remaining: $TOTAL_CURRENT"
echo ""

# Progress bar
BAR_LENGTH=40
FILLED=$((PROGRESS_PERCENT * BAR_LENGTH / 100))
BAR=$(printf "█%.0s" $(seq 1 $FILLED))
EMPTY=$(printf "░%.0s" $(seq 1 $((BAR_LENGTH - FILLED))))
echo -e "  [${GREEN}${BAR}${NC}${EMPTY}] ${PROGRESS_PERCENT}%"
echo ""

# Status
if [ "$TOTAL_CURRENT" -eq 0 ]; then
    echo -e "${GREEN}✓ SUCCESS! All knip errors fixed!${NC}"
    echo ""
    echo -e "${BLUE}Step 2: Verifying TypeScript compilation...${NC}"
    echo ""
    
    if bun check; then
        echo ""
        echo -e "${GREEN}✓ TypeScript compilation successful!${NC}"
        echo ""
        echo -e "${GREEN}🎉 Mission Complete! 🎉${NC}"
        echo ""
        echo "You can now delete the following files:"
        echo "  - KNIP_CLEANUP_PROMPT.md"
        echo "  - KNIP_QUICK_REF.md"
        echo "  - KNIP_PROGRESS.md"
        echo "  - KNIP_SESSION_PROMPT.md"
        echo "  - KNIP_CLEANUP_INSTRUCTIONS_FOR_VIKTOR.md"
        echo "  - scripts/verify-knip-progress.sh"
        exit 0
    else
        echo ""
        echo -e "${RED}✗ TypeScript compilation failed!${NC}"
        echo "Knip is clean but there are TypeScript errors to fix."
        exit 1
    fi
elif [ "$DUPLICATE_COUNT" -gt 0 ]; then
    echo -e "${YELLOW}➜ Phase 1: Still fixing duplicate exports${NC}"
    echo "  Focus: Fix remaining $DUPLICATE_COUNT duplicate exports first"
else
    echo -e "${YELLOW}➜ Phase 2: Fixing unused exports${NC}"
    echo "  Focus: Fix remaining $UNUSED_COUNT unused exports"
fi

echo ""
echo -e "${BLUE}Current Priority:${NC}"

if [ "$DUPLICATE_COUNT" -gt 0 ]; then
    echo "  1. Fix duplicate exports"
    echo ""
    echo "  Tip: Run 'bun knip | grep -A 20 \"Duplicate exports\"' to see the list"
else
    echo "  1. Continue fixing unused exports"
    echo ""
    echo "  Tip: Run 'bun knip | grep -A 50 \"Unused exports\"' to see the list"
fi

echo ""
echo -e "${BLUE}Next Steps:${NC}"
echo "  1. Review KNIP_PROGRESS.md for current status"
echo "  2. Continue with the next batch of fixes"
echo "  3. Run this script again after changes: ./scripts/verify-knip-progress.sh"
echo ""

# Show detailed knip output if requested
if [ "$1" = "--verbose" ] || [ "$1" = "-v" ]; then
    echo -e "${BLUE}Full Knip Output:${NC}"
    echo "----------------------------------------"
    echo "$KNIP_OUTPUT"
fi

exit $KNIP_EXIT_CODE

