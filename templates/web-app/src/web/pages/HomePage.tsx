// @if db
import { Button, Card, FifthElement, Icon } from '../design/components';
// @endif
// @if !db
import { Card, FifthElement, Icon } from '../design/components';
// @endif
import { useMe } from '../Layout';

export function HomePage() {
  const me = useMe();
  return (
    <>
      <section className="app-hero">
        <FifthElement corner="top-right" color="var(--itm8-white)" size={260} offset={-30} />
        <p className="itm8-overline app-hero__overline">__TITLE__</p>
        <h1>Welcome{me.data?.name ? `, ${me.data.name}` : ''}</h1>
        <p className="app-hero__lead">
          A starting point that already follows the AI Factory build rules. Replace this page with what your users
          need first.
        </p>
{/* @if db */}
        <Button href="/items" variant="pop">
          Open items <span aria-hidden="true">→</span>
        </Button>
{/* @endif */}
      </section>

      <div className="app-grid">
        <Card>
          <Icon name="security" tile />
          <h3>Signed in by the platform</h3>
          <p>Easy Auth signs users in before a request reaches the app. The server reads the user and checks roles.</p>
        </Card>
{/* @if db */}
        <Card>
          <Icon name="databases" tile />
          <h3>PostgreSQL with no password</h3>
          <p>In Azure the app signs in to the database with its managed identity. Every change is audited.</p>
        </Card>
{/* @endif */}
{/* @if ai */}
        <Card>
          <Icon name="digital-transformation" tile />
          <h3>AI through Azure AI Foundry</h3>
          <p>Model calls use EU deployments and the app&apos;s identity, with a per-user limit.</p>
        </Card>
{/* @endif */}
      </div>
    </>
  );
}
