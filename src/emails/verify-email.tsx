import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
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
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </Head>
      <Preview>Verify your BrainLS email address</Preview>
      <Body style={body}>
        <Container style={container}>
          <Heading style={logo}>BrainLS</Heading>
          <Hr style={divider} />
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
          <Hr style={divider} />
          <Text style={footer}>
            If you didn&apos;t create an account, you can safely ignore this email.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export default VerifyEmail;

VerifyEmail.PreviewProps = {
  url: "https://brainls.com/api/auth/verify-email?token=abc123def456",
  userName: "John",
} satisfies VerifyEmailProps;

const body = {
  backgroundColor: "#ede4d3",
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  margin: "0",
  padding: "24px 12px",
  textAlign: "center" as const,
  WebkitTextSizeAdjust: "100%" as const,
  MsTextSizeAdjust: "100%" as const,
};

const container = {
  margin: "0 auto",
  padding: "32px 24px",
  width: "100%",
  maxWidth: "480px",
  backgroundColor: "#f5eed9",
  borderRadius: "12px",
  border: "1px solid #d9cdb8",
  textAlign: "center" as const,
};

const logo = {
  fontSize: "22px",
  fontWeight: "700" as const,
  color: "#3d3225",
  margin: "0 0 16px 0",
  letterSpacing: "-0.025em",
};

const divider = {
  borderColor: "#d9cdb8",
  margin: "20px 0",
};

const text = {
  fontSize: "15px",
  lineHeight: "26px",
  color: "#3d3225",
  margin: "8px 0",
};

const buttonSection = {
  textAlign: "center" as const,
  margin: "28px 0",
};

const button = {
  backgroundColor: "#a0550d",
  borderRadius: "8px",
  color: "#f5eed9",
  fontSize: "16px",
  fontWeight: "600" as const,
  textDecoration: "none",
  padding: "14px 40px",
  textAlign: "center" as const,
};

const link = {
  fontSize: "13px",
  color: "#a0550d",
  wordBreak: "break-all" as const,
};

const muted = {
  fontSize: "13px",
  lineHeight: "20px",
  color: "#8a7d6b",
  margin: "8px 0",
};

const footer = {
  fontSize: "12px",
  lineHeight: "18px",
  color: "#8a7d6b",
  margin: "0",
};
