import { describe, it, expect } from 'vitest';
import { discoverProfileInventory } from './profile-inventory.js';
describe('profile completeness inventory',()=>{
 it('does not count a footer email as staff coverage',()=>expect(discoverProfileInventory('<button><h3>Jana Testová</h3>Zobrazit profil</button><a href="mailto:info@example.org">info@example.org</a>')).toEqual(['Jana Testová']));
 it('deduplicates desktop/mobile and role cards',()=>expect(discoverProfileInventory('<button><h3>Jana Testová</h3>Zobrazit profil</button>'.repeat(3))).toEqual(['Jana Testová']));
 it('does not click unrelated controls or parse script payloads',()=>expect(discoverProfileInventory('<button>Povolit vše</button><script>const name="Jana Testová"</script>')).toEqual([]));
});
