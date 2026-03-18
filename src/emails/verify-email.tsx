import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Section,
  Text,
  Button,
} from "@react-email/components";

interface VerifyEmailProps {
  url: string;
  userName?: string;
}

export function VerifyEmail({ url, userName }: VerifyEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Verify your BrainLS email address</Preview>
      <Body style={body}>
        <Container style={container}>
          <Heading style={heading}>BrainLS</Heading>
          <Text style={text}>Hi{userName ? ` ${userName}` : ""},</Text>
          <Text style={text}>
            Thanks for signing up! Please verify your email address by clicking the button below.
          </Text>
          <Section style={buttonSection}>
            <Button style={button} href={url}>
              Verify Email
            </Button>
          </Section>
          <Text style={muted}>
            If the button doesn&apos;t work, copy and paste this link into your browser:
          </Text>
          <Link href={url} style={link}>
            {url}
          </Link>
          <Text style={muted}>
            If you didn&apos;t create an account, you can safely ignore this email.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export default VerifyEmail;

const body = {
  backgroundColor: "#0a0a0a",
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
};

const container = {
  margin: "0 auto",
  padding: "40px 24px",
  maxWidth: "480px",
};

const heading = {
  fontSize: "24px",
  fontWeight: "700" as const,
  color: "#f5f5f5",
  marginBottom: "24px",
};

const text = {
  fontSize: "15px",
  lineHeight: "24px",
  color: "#d4d4d4",
  margin: "8px 0",
};

const buttonSection = {
  textAlign: "center" as const,
  margin: "24px 0",
};

const button = {
  backgroundColor: "#f97316",
  borderRadius: "8px",
  color: "#fff",
  fontSize: "15px",
  fontWeight: "600" as const,
  textDecoration: "none",
  padding: "12px 32px",
  display: "inline-block",
};

const link = {
  fontSize: "13px",
  color: "#f97316",
  wordBreak: "break-all" as const,
};

const muted = {
  fontSize: "13px",
  lineHeight: "20px",
  color: "#737373",
  margin: "8px 0",
};
